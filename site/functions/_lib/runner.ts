// 调用远端运行器集群（Go 单二进制 cd-runner）。每个节点是一台跑着 cd-runner + fc-manager 的虚拟机 / KVM 主机，经 Cloudflare Tunnel 有自己的地址。
//
// 节点表 RUNNER_NODES（wrangler.toml，公开）：「编号=地址」用逗号隔开，比如
//   lou1=https://run-lou1.codingdance.cn,lou2=https://run-lou2.codingdance.cn
// 各节点共用签名密钥 RUNNER_SECRET（加密环境变量）；签名里带着节点编号，签给 A 的请求在 B 上不认（算法和 internal/runner/sign.go 一样）。
// 运行器前面开了 Cloudflare Access 的话，再带上服务令牌 RUNNER_ACCESS_ID / RUNNER_ACCESS_SECRET（加密环境变量）。

export interface RunnerEnv {
  RUNNER_NODES?: string;
  RUNNER_SECRET?: string;
  RUNNER_ACCESS_ID?: string;
  RUNNER_ACCESS_SECRET?: string;
  /** 可选：专供 #/admin 拉取运行器集群遥测的令牌；未配置时回退认 RUNNER_SECRET */
  RUNNER_ADMIN_TOKEN?: string;
}
export interface RunnerNode { id: string; url: string }
export interface NodeStatus {
  node?: string;
  langs?: string[];
  debugLangs?: string[];
  features?: string[];
  slots?: number;
  queue?: number;
  busy?: number;
  queued?: number;
  dapActive?: number;
  version?: string;
}

export const LANG_FEATURES: Record<string, string> = { typescript: "ts-transform" };

/** 这个节点能不能跑这门语言：langs 里有、要的 features 也有（状态还不知道时当作能） */
export function nodeFits(s: NodeStatus | null | undefined, lang: string | undefined, debug = false, extraFeature?: string): boolean {
  if (!s) return true;
  if (extraFeature && !(s.features ?? []).includes(extraFeature)) return false;
  if (!lang) return true;
  const langs = debug ? s.debugLangs : s.langs;
  if (langs && !langs.includes(lang)) return false;
  const need = LANG_FEATURES[lang];
  return !need || (s.features ?? []).includes(need);
}

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const NODE_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

export async function sha256(body: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(body)));
}

/** 要签的内容：方法、路径、时间、随机串、用户、节点编号、请求体的 SHA-256，用换行连起来 */
export function canonical(p: { method: string; path: string; time: number | string; nonce: string; user: string; node: string; bodyHash: string }): string {
  return [p.method.toUpperCase(), p.path, String(p.time), p.nonce, p.user || "", p.node, p.bodyHash].join("\n");
}

export async function sign(secret: string, p: Parameters<typeof canonical>[0]): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(canonical(p))));
}

/** 节点表；写错的条目跳过 */
export function parseNodes(v: string | undefined): RunnerNode[] {
  const out: RunnerNode[] = [];
  for (const part of String(v || "").split(",")) {
    const m = part.trim().match(/^([^=\s]+)=(https?:\/\/\S+)$/);
    if (m && NODE_ID.test(m[1]) && !out.some((n) => n.id === m[1])) out.push({ id: m[1], url: m[2].replace(/\/+$/, "") });
  }
  return out;
}

export const runnerConfigured = (env: RunnerEnv) => parseNodes(env.RUNNER_NODES).length > 0 && !!env.RUNNER_SECRET && env.RUNNER_SECRET.length >= 32;

/** 带签名调一个节点；返回它的原始响应 */
export async function callNode(env: RunnerEnv, node: RunnerNode, method: "GET" | "POST", path: string, user: string, body = "", opts: { now?: number; timeoutMs?: number } = {}): Promise<Response> {
  const time = Math.floor((opts.now ?? Date.now()) / 1000);
  const nonce = hex(crypto.getRandomValues(new Uint8Array(12)).buffer);
  const headers: Record<string, string> = {
    "x-runner-time": String(time),
    "x-runner-nonce": nonce,
    "x-runner-user": user,
    "x-runner-node": node.id,
    "x-runner-signature": await sign(env.RUNNER_SECRET!, { method, path, time, nonce, user, node: node.id, bodyHash: await sha256(body) }),
  };
  if (method === "POST") headers["content-type"] = "application/json";
  if (env.RUNNER_ACCESS_ID && env.RUNNER_ACCESS_SECRET) {
    headers["cf-access-client-id"] = env.RUNNER_ACCESS_ID;
    headers["cf-access-client-secret"] = env.RUNNER_ACCESS_SECRET;
  }
  return fetch(node.url + path, { method, headers, body: method === "POST" ? body : undefined, signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined });
}

/** 生成发往 cd-runner 节点 /v1/dap 的带签名 URL（供边缘侧 WebSocket Upgrade 转发） */
export async function signedDapUrl(env: RunnerEnv, node: RunnerNode, user: string, now = Date.now()): Promise<string> {
  const time = Math.floor(now / 1000);
  const nonce = hex(crypto.getRandomValues(new Uint8Array(12)).buffer);
  const sig = await sign(env.RUNNER_SECRET!, {
    method: "GET",
    path: "/v1/dap",
    time,
    nonce,
    user,
    node: node.id,
    bodyHash: await sha256(""),
  });
  const q = new URLSearchParams({ time: String(time), nonce, user, node: node.id, sig });
  return `${node.url}/v1/dap?${q.toString()}`;
}

// —— 节点状态：每个 Worker 实例里记一份 ——
type Seen = { at: number; status: NodeStatus | null; downUntil: number; busyUntil: number };
const seen = new Map<string, Seen>();
const STATUS_TTL = 15000, DOWN_MS = 30000, BUSY_MS = 5000;
const entry = (id: string) => seen.get(id) || { at: 0, status: null, downUntil: 0, busyUntil: 0 };

export function markDown(node: RunnerNode, now = Date.now()) { seen.set(node.id, { ...entry(node.id), downUntil: now + DOWN_MS }); }
export function markBusy(node: RunnerNode, now = Date.now()) { seen.set(node.id, { ...entry(node.id), busyUntil: now + BUSY_MS }); }
export function forgetNodes() { seen.clear(); }

/** 各节点的状态（过期了才重新问，问的时候并行、每个最多等 2 秒）；不在线的是 null */
export async function nodeStatuses(env: RunnerEnv, now = Date.now()): Promise<Map<string, NodeStatus | null>> {
  const nodes = parseNodes(env.RUNNER_NODES);
  await Promise.all(nodes.map(async (n) => {
    const e = entry(n.id);
    if (now - e.at < STATUS_TTL) return;
    try {
      const res = await callNode(env, n, "GET", "/v1/status", "", "", { now, timeoutMs: 2000 });
      const status = res.ok ? ((await res.json()) as NodeStatus) : null;
      seen.set(n.id, { ...entry(n.id), at: now, status, downUntil: status ? 0 : now + DOWN_MS });
    } catch {
      seen.set(n.id, { ...entry(n.id), at: now, status: null, downUntil: now + DOWN_MS });
    }
  }));
  return new Map(nodes.map((n) => [n.id, entry(n.id).status]));
}

/** 32 位 FNV-1a，换成 (0, 1) 之间的数 */
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return ((h >>> 0) + 0.5) / 4294967296;
}

export function pickOrder(nodes: RunnerNode[], user: string, opts: { lang?: string; debug?: boolean; feature?: string; now?: number } = {}): RunnerNode[] {
  const now = opts.now ?? Date.now();
  const scored = nodes.map((n) => {
    const e = entry(n.id), s = e.status;
    const weight = Math.max(1, Number(s?.slots) || 1);
    const score = -weight / Math.log(unit(`${user}\n${n.id}`));
    const unfit = !nodeFits(s, opts.lang, opts.debug, opts.feature);
    const down = e.downUntil > now;
    const busy = e.busyUntil > now || !!(s && s.slots !== undefined && s.queue !== undefined && (s.busy ?? 0) >= s.slots && (s.queued ?? 0) >= s.queue);
    return { n, score, rank: unfit ? 3 : down ? 2 : busy ? 1 : 0 };
  });
  scored.sort((a, b) => a.rank - b.rank || b.score - a.score);
  return scored.map((x) => x.n);
}

export async function runOnCluster(env: RunnerEnv, user: string, body: string, opts: { lang?: string; debug?: boolean } = {}): Promise<{ res: Response | null; node?: RunnerNode; tried: string[] }> {
  const nodes = parseNodes(env.RUNNER_NODES);
  await nodeStatuses(env);
  const tried: string[] = [];
  for (const node of pickOrder(nodes, user, opts)) {
    tried.push(node.id);
    try {
      const res = await callNode(env, node, "POST", "/v1/run", user, body);
      if (res.status === 503) { markBusy(node); continue; }
      if (res.status === 401 || res.status >= 500) { markDown(node); continue; }
      return { res, node, tried };
    } catch {
      markDown(node);
    }
  }
  return { res: null, tried };
}

/** 将浏览器的 WebSocket Upgrade 请求按用户固定节点路由至支持 dap-ws 的 cd-runner 节点 */
export async function dapOnCluster(request: Request, env: RunnerEnv, user: string, lang: string): Promise<{ res: Response | null; node?: RunnerNode; tried: string[] }> {
  const nodes = parseNodes(env.RUNNER_NODES);
  await nodeStatuses(env);
  const tried: string[] = [];
  for (const node of pickOrder(nodes, user, { lang, debug: true, feature: "dap-ws" })) {
    tried.push(node.id);
    try {
      const targetUrl = await signedDapUrl(env, node, user);
      const headers = new Headers();
      headers.set("Upgrade", "websocket");
      headers.set("Connection", "Upgrade");
      for (const k of ["Sec-WebSocket-Key", "Sec-WebSocket-Version", "Sec-WebSocket-Protocol", "Sec-WebSocket-Extensions"]) {
        const v = request.headers.get(k);
        if (v) headers.set(k, v);
      }
      if (env.RUNNER_ACCESS_ID && env.RUNNER_ACCESS_SECRET) {
        headers.set("cf-access-client-id", env.RUNNER_ACCESS_ID);
        headers.set("cf-access-client-secret", env.RUNNER_ACCESS_SECRET);
      }
      const res = await fetch(targetUrl, { method: "GET", headers });
      if (res.status === 503) { markBusy(node); continue; }
      if (res.status === 401 || res.status >= 500) { markDown(node); continue; }
      return { res, node, tried };
    } catch {
      markDown(node);
    }
  }
  return { res: null, tried };
}

/** 聚合所有 cd-runner 节点的实时状态与 OTel 指标快照，供 #/admin 联合监控面板拉取 */
export async function clusterTelemetry(env: RunnerEnv, now = Date.now()) {
  const nodes = parseNodes(env.RUNNER_NODES);
  const items = await Promise.all(nodes.map(async (node) => {
    try {
      const [stRes, telRes] = await Promise.all([
        callNode(env, node, "GET", "/v1/status", "admin", "", { now, timeoutMs: 3000 }),
        callNode(env, node, "GET", "/v1/admin/telemetry", "admin", "", { now, timeoutMs: 3000 }),
      ]);
      const status = stRes.ok ? ((await stRes.json()) as NodeStatus) : null;
      const telemetry = telRes.ok ? ((await telRes.json()) as Record<string, unknown>) : null;
      return { id: node.id, url: node.url, online: !!status, status, telemetry };
    } catch {
      return { id: node.id, url: node.url, online: false, status: null, telemetry: null };
    }
  }));
  const up = items.filter((x) => x.online && x.status);
  return {
    ok: true,
    timestamp: new Date(now).toISOString(),
    summary: {
      totalNodes: nodes.length,
      onlineNodes: up.length,
      totalSlots: up.reduce((s, x) => s + (x.status?.slots || 0), 0),
      busySlots: up.reduce((s, x) => s + (x.status?.busy || 0), 0),
      queuedJobs: up.reduce((s, x) => s + (x.status?.queued || 0), 0),
      activeDapSessions: up.reduce((s, x) => s + (x.status?.dapActive || 0), 0),
    },
    nodes: items,
  };
}
