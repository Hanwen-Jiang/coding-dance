#!/usr/bin/env node
// 远端运行器的 HTTP 服务。部署在 win-gw-lou 上的 Linux 虚拟机里，经 Cloudflare Tunnel 对外，只接受网站签过名的请求。
// 每个任务在一个全新的容器里跑（lib/sandbox.mjs），结果原样交回网站。不保存用户的代码和结果，日志只记谁、什么语言、用了多久。
// 用法和环境变量见 README.md；本机开发：RUNNER_DRIVER=local RUNNER_ALLOW_LOCAL=1 RUNNER_SECRET=<至少 32 个字符> node tools/runner/server.mjs
import http from "node:http";
import { verify, NonceCache, NODE_ID } from "./lib/sign.mjs";
import { DockerPool, FirecrackerDriver, LocalDriver } from "./lib/sandbox.mjs";

const env = process.env;
const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d);
export const CONFIG = {
  /** 这个节点在集群里的编号（网站的 RUNNER_NODES 里写的那个），签名里带着它 */
  node: env.RUNNER_NODE_ID || "",
  port: num(env.RUNNER_PORT, 8790),
  host: env.RUNNER_HOST || "127.0.0.1",
  secret: env.RUNNER_SECRET || "",
  /** firecracker（生产）、docker（开发和 CI，要 RUNNER_ALLOW_DOCKER=1）、local（本机，不隔离，要 RUNNER_ALLOW_LOCAL=1） */
  driver: env.RUNNER_DRIVER || "firecracker",
  /** fc-manager 的地址和令牌（令牌就是 fc-manager 的 SecretStore 里 sandbox/fc-manager-token 的值） */
  fcUrl: env.RUNNER_FC_URL || "http://127.0.0.1:8097",
  fcToken: env.RUNNER_FC_TOKEN || "",
  fcRuntime: env.RUNNER_FC_RUNTIME || "lc-runner",
  fcCpuMillis: num(env.RUNNER_FC_CPU_MILLIS, 1000),
  fcMemoryMb: num(env.RUNNER_FC_MEMORY_MB, 1024),
  image: env.RUNNER_IMAGE || "lc-runner:latest",
  runtime: env.RUNNER_RUNTIME || "",
  pool: num(env.RUNNER_POOL, 2),
  slots: num(env.RUNNER_SLOTS, 2),
  queue: num(env.RUNNER_QUEUE, 20),
  memory: env.RUNNER_MEMORY || "1g",
  cpus: env.RUNNER_CPUS || "1",
  pids: num(env.RUNNER_PIDS, 256),
  perMinute: num(env.RUNNER_USER_PER_MIN, 20),
  caseMs: num(env.RUNNER_CASE_MS, 3000),
  totalMs: num(env.RUNNER_TOTAL_MS, 30000),
  jobMs: num(env.RUNNER_JOB_MS, 90000),
  version: env.RUNNER_VERSION || "dev",
};
// 和 sandbox/programs.js 的 LANG_IDS 一样（部署时只复制 server.mjs 和 lib/，所以写在这里；server.test.mjs 核对两边一致）。
// 网站按 /v1/status 里的 langs 判断哪些语言能在云端跑：节点还没更新到新镜像时，新语言显示成暂时不能用
export const LANGS = ["python", "java", "cpp", "go", "javascript", "typescript", "c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart"];
export const DEBUG_LANGS = ["java", "cpp", "go"];
// 沙箱这一版带上的改动：有的语言要节点更新到带这一项的版本才交给它（网站 functions/_lib/runner.ts 的 LANG_FEATURES）。
//   ts-transform：TypeScript 先查语法（报成编译错误）、能转换 enum 和构造函数参数属性
export const FEATURES = ["ts-transform"];
const MAX_BODY = 2 << 20;

const log = (o) => console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));

/** 任务的格式检查（沙箱里还会再查一遍） */
export function validate(job) {
  if (!job || typeof job !== "object" || Array.isArray(job)) return "请求体要是一个 JSON 对象";
  if (!LANGS.includes(job.lang)) return "不支持的语言";
  if (job.mode !== "leetcode" && job.mode !== "acm") return "模式只能是 leetcode 或 acm";
  if (typeof job.code !== "string" || !job.code.trim()) return "代码是空的";
  if (job.code.length > 100000) return "代码不能超过 100 KB";
  if (!Array.isArray(job.cases) || !job.cases.length) return "至少要有一组用例";
  if (job.cases.length > 100) return "一次最多 100 组用例";
  if (job.debug && !DEBUG_LANGS.includes(job.lang)) return "这门语言不能在云端调试";
  if (job.debug && job.cases.length !== 1) return "调试一次只跑一组用例";
  if (job.mode === "leetcode" && (!job.sig || typeof job.sig !== "object")) return "力扣模式要有函数签名";
  for (const c of job.cases) {
    if (!c || typeof c !== "object") return "用例格式不对";
    if (job.mode === "leetcode" && !Array.isArray(c.input)) return "力扣模式的用例要有 input";
    if (job.mode === "acm" && typeof c.stdin !== "string") return "ACM 模式的用例要有 stdin";
  }
  return null;
}

/** 每个用户：每分钟最多 perMinute 次，同时最多一个 */
class UserLimits {
  constructor(perMinute) { this.perMinute = perMinute; this.users = new Map(); }
  admit(user, now = Date.now()) {
    const u = this.users.get(user) || { times: [], running: 0 };
    u.times = u.times.filter((t) => now - t < 60000);
    if (u.running >= 1) return "上一次运行还没结束";
    if (u.times.length >= this.perMinute) return "运行得太频繁了，等一分钟再试";
    u.times.push(now);
    u.running++;
    this.users.set(user, u);
    return null;
  }
  done(user) {
    const u = this.users.get(user);
    if (u) u.running = Math.max(0, u.running - 1);
    if (this.users.size > 10000) for (const [k, v] of this.users) if (!v.running && !v.times.length) this.users.delete(k);
  }
}

/** 同时最多 slots 个任务，最多 queue 个在排队 */
class Slots {
  constructor(slots, queue) { this.max = slots; this.queueMax = queue; this.busy = 0; this.waiting = []; }
  acquire() {
    if (this.busy < this.max) { this.busy++; return Promise.resolve(); }
    if (this.waiting.length >= this.queueMax) return null;
    return new Promise((resolve) => this.waiting.push(resolve));
  }
  release() {
    const next = this.waiting.shift();
    if (next) next(); else this.busy--;
  }
}

function readBody(req, max) {
  return new Promise((resolve) => {
    const parts = [];
    let size = 0, over = false;
    req.on("data", (b) => { size += b.length; if (size > max) over = true; else parts.push(b); });
    req.on("end", () => resolve(over ? null : Buffer.concat(parts)));
    req.on("error", () => resolve(null));
  });
}

function send(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers });
  res.end(text);
}

export function createServer(cfg = CONFIG, driver) {
  const nonces = new NonceCache(), limits = new UserLimits(cfg.perMinute), slots = new Slots(cfg.slots, cfg.queue);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://runner");
    if (req.method === "GET" && url.pathname === "/healthz") return send(res, 200, { ok: true });
    const body = await readBody(req, MAX_BODY);
    if (body === null) return send(res, 413, { error: "请求太大了" });
    const auth = verify(cfg.secret, { method: req.method, path: url.pathname, headers: req.headers, body, node: cfg.node, nonces });
    if (!auth.ok) { log({ event: "denied", path: url.pathname, reason: auth.reason }); return send(res, 401, { error: auth.reason }); }

    if (req.method === "GET" && url.pathname === "/v1/status") {
      // 网站按这些挑节点：slots 是容量（权重），busy / queued 是现在的负载
      return send(res, 200, { ok: true, node: cfg.node, version: cfg.version, langs: LANGS, debugLangs: DEBUG_LANGS, features: FEATURES, pool: driver.status(), slots: cfg.slots, queue: cfg.queue, busy: slots.busy, queued: slots.waiting.length, limits: { caseMs: cfg.caseMs, totalMs: cfg.totalMs, perMinute: cfg.perMinute, cases: 100, steps: 1000 } });
    }
    if (req.method !== "POST" || url.pathname !== "/v1/run") return send(res, 404, { error: "没有这个接口" });

    let job;
    try { job = JSON.parse(body.toString("utf8")); } catch { return send(res, 400, { error: "请求体不是合法的 JSON" }); }
    const bad = validate(job);
    if (bad) return send(res, 400, { error: bad });
    const user = auth.user || "anonymous";
    const limited = limits.admit(user);
    if (limited) return send(res, 429, { error: limited }, { "retry-after": "10" });
    const slot = slots.acquire();
    if (!slot) { limits.done(user); return send(res, 503, { error: "云端运行的人太多了，稍后再试" }, { "retry-after": "15" }); }
    const t0 = Date.now();
    await slot;
    const queueMs = Date.now() - t0;
    try {
      const task = { lang: job.lang, mode: job.mode, code: job.code, sig: job.sig, cases: job.cases.map((c) => (job.mode === "acm" ? { stdin: c.stdin } : { input: c.input })), debug: !!job.debug, limits: { caseMs: cfg.caseMs, totalMs: cfg.totalMs, steps: 1000 } };
      const r = await driver.run(JSON.stringify(task), cfg.jobMs);
      const totalMs = Date.now() - t0;
      log({ event: "run", node: cfg.node, user, lang: job.lang, mode: job.mode, debug: !!job.debug, cases: job.cases.length, queueMs, totalMs, ok: r.ok && r.json.ok, compileError: !!(r.ok && r.json.compileError) });
      // 这台机器的 microVM 满了：503，网站换别的节点
      if (!r.ok && r.busy) return send(res, 503, { error: r.error }, { "retry-after": "5" });
      if (!r.ok) return send(res, 502, { error: r.error });
      if (!r.json.ok) return send(res, 400, { error: r.json.error || "运行失败" });
      return send(res, 200, { ...r.json, node: cfg.node, queueMs, totalMs });
    } catch (e) {
      log({ event: "error", user, error: String(e.message || e) });
      return send(res, 500, { error: "运行器出错了" });
    } finally {
      slots.release();
      limits.done(user);
    }
  });
  return server;
}

async function main() {
  if (CONFIG.secret.length < 32) { console.error("RUNNER_SECRET 要设成至少 32 个字符的随机串（和网站的 RUNNER_SECRET 一样）"); process.exit(1); }
  if (!NODE_ID.test(CONFIG.node)) { console.error("RUNNER_NODE_ID 要设成这个节点的编号（小写字母、数字、横线，比如 lou1），和网站 RUNNER_NODES 里写的一样"); process.exit(1); }
  if (CONFIG.driver === "local" && env.RUNNER_ALLOW_LOCAL !== "1") { console.error("RUNNER_DRIVER=local 不隔离用户代码，只能本机开发用；确定的话再设 RUNNER_ALLOW_LOCAL=1"); process.exit(1); }
  // Docker 和宿主共用内核，挡不住内核漏洞：生产上跑公开用户的代码要用 firecracker（每次一台 microVM）
  if (CONFIG.driver === "docker" && env.RUNNER_ALLOW_DOCKER !== "1") { console.error("RUNNER_DRIVER=docker 和宿主共用内核，只能开发和测试用；生产上用 firecracker。确定的话再设 RUNNER_ALLOW_DOCKER=1"); process.exit(1); }
  if (CONFIG.driver === "firecracker" && !CONFIG.fcToken) { console.error("RUNNER_DRIVER=firecracker 要设 RUNNER_FC_TOKEN（fc-manager 的 API 令牌）"); process.exit(1); }
  const driver = CONFIG.driver === "local" ? new LocalDriver()
    : CONFIG.driver === "firecracker" ? new FirecrackerDriver({ url: CONFIG.fcUrl, token: CONFIG.fcToken, runtime: CONFIG.fcRuntime, cpuMillis: CONFIG.fcCpuMillis, memoryMb: CONFIG.fcMemoryMb, log })
      : new DockerPool({ image: CONFIG.image, size: CONFIG.pool, runtime: CONFIG.runtime, memory: CONFIG.memory, cpus: CONFIG.cpus, pids: CONFIG.pids, log });
  await driver.init();
  const server = createServer(CONFIG, driver);
  server.listen(CONFIG.port, CONFIG.host, () => log({ event: "listening", node: CONFIG.node, host: CONFIG.host, port: CONFIG.port, driver: CONFIG.driver, image: CONFIG.image, runtime: CONFIG.runtime || "runc" }));
  const stop = async () => { server.close(); await driver.close(); process.exit(0); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) main().catch((e) => { console.error(e.message || e); process.exit(1); });
