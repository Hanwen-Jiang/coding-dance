import { DurableObject } from "cloudflare:workers";

type RunnerGroup = "script" | "jvm" | "native";

interface ContainerPort {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface ContainerBinding {
  readonly running: boolean;
  start(options?: {
    entrypoint?: string[];
    env?: Record<string, string>;
    enableInternet?: boolean;
  }): void;
  monitor(): Promise<void>;
  destroy(error?: unknown): Promise<void>;
  getTcpPort(port: number): ContainerPort;
  setInactivityTimeout?(ms: number): void | Promise<void>;
}

interface DOStorageLike {
  setAlarm(scheduledTime: number | Date): Promise<void>;
}

interface DOStateLike {
  container?: ContainerBinding;
  storage: DOStorageLike;
  waitUntil(p: Promise<unknown>): void;
}

interface DOStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DONamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DOStubLike;
}

export interface Env {
  RUNNER_NODE_ID?: string;
  RUNNER_SECRET?: string;
  CONTAINER_SLEEP_MS?: string;
  RUNNER_SCRIPT: DONamespaceLike;
  RUNNER_JVM: DONamespaceLike;
  RUNNER_NATIVE: DONamespaceLike;
}

const LANG_TO_GROUP: Record<string, RunnerGroup> = {
  python: "script",
  javascript: "script",
  typescript: "script",
  ruby: "script",
  php: "script",
  java: "jvm",
  kotlin: "jvm",
  scala: "jvm",
  c: "native",
  cpp: "native",
  go: "native",
  rust: "native",
};

const POC_LANGS = Object.keys(LANG_TO_GROUP);
const POC_DEBUG_LANGS = ["java", "cpp", "go"];
const POC_FEATURES = ["ts-transform", "dap-ws", "otel-metrics", "cf-containers-poc"];
const CLOCK_SKEW_SEC = 120;
const CONTAINER_PORT = 8790;

const enc = new TextEncoder();

function jsonRes(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(
  secret: string,
  method: string,
  path: string,
  headers: Headers,
  query: URLSearchParams,
  allowQuery: boolean,
  bodyBytes: Uint8Array,
  expectedNode: string,
): Promise<{ ok: true; user: string } | { ok: false; reason: string }> {
  if (!secret || secret.length < 32) {
    return { ok: false, reason: "运行器密钥未配置" };
  }
  let timeStr = headers.get("x-runner-time") || "";
  let nonce = headers.get("x-runner-nonce") || "";
  let user = headers.get("x-runner-user") || "";
  let node = headers.get("x-runner-node") || "";
  let sig = headers.get("x-runner-signature") || "";

  if (!sig && allowQuery) {
    timeStr = query.get("time") || "";
    nonce = query.get("nonce") || "";
    user = query.get("user") || "";
    node = query.get("node") || "";
    sig = query.get("sig") || "";
  }
  if (!timeStr || !nonce || !node || !sig) {
    return { ok: false, reason: "缺少签名请求头" };
  }
  if (node !== expectedNode) {
    return { ok: false, reason: `这个请求是发给节点 ${node} 的，不是 ${expectedNode}` };
  }
  const ts = Number(timeStr);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > CLOCK_SKEW_SEC) {
    return { ok: false, reason: "签名过期了" };
  }
  if (nonce.length < 16 || nonce.length > 128) {
    return { ok: false, reason: "随机串格式不对" };
  }
  const bodyHash = await sha256Hex(bodyBytes);
  const canonical = [method.toUpperCase(), path, timeStr, nonce, user, node, bodyHash].join("\n");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(canonical));
  const expectedSig = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!constantTimeEqualHex(sig.toLowerCase(), expectedSig)) {
    return { ok: false, reason: "签名不对" };
  }
  return { ok: true, user: user || "anonymous" };
}

function bindingForGroup(env: Env, group: RunnerGroup): DONamespaceLike {
  if (group === "script") return env.RUNNER_SCRIPT;
  if (group === "jvm") return env.RUNNER_JVM;
  return env.RUNNER_NATIVE;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const nodeID = env.RUNNER_NODE_ID || "cf-poc";

    if (request.method === "GET" && url.pathname === "/healthz") {
      return jsonRes({ ok: true, node: nodeID, groups: ["script", "jvm", "native"] });
    }

    const allowQuery = request.method === "GET" && url.pathname === "/v1/dap";
    const bodyBuf = request.method === "GET" || request.method === "HEAD" ? new ArrayBuffer(0) : await request.arrayBuffer();
    const bodyBytes = new Uint8Array(bodyBuf);

    const auth = await verifySignature(
      env.RUNNER_SECRET || "",
      request.method,
      url.pathname,
      request.headers,
      url.searchParams,
      allowQuery,
      bodyBytes,
      nodeID,
    );
    if (!auth.ok) {
      return jsonRes({ error: auth.reason }, 401);
    }

    if (request.method === "GET" && url.pathname === "/v1/status") {
      return jsonRes({
        ok: true,
        node: nodeID,
        version: "cf-poc",
        langs: POC_LANGS,
        debugLangs: POC_DEBUG_LANGS,
        features: POC_FEATURES,
        pool: { driver: "cloudflare-containers", groups: ["script", "jvm", "native"] },
        slots: 12,
        queue: 20,
        busy: 0,
        queued: 0,
        dapActive: 0,
        limits: { caseMs: 3000, totalMs: 30000, perMinute: 60, cases: 100, steps: 1000 },
      });
    }

    let group: RunnerGroup = "native";
    if (request.method === "POST" && url.pathname === "/v1/run") {
      let lang = "";
      try {
        const parsed = JSON.parse(new TextDecoder().decode(bodyBytes)) as { lang?: unknown };
        if (typeof parsed.lang === "string") lang = parsed.lang;
      } catch {
        return jsonRes({ error: "请求体不是合法的 JSON" }, 400);
      }
      const mapped = LANG_TO_GROUP[lang];
      if (!mapped) {
        return jsonRes({ error: lang ? `PoC 暂不支持语言：${lang}` : "不支持的语言" }, 400);
      }
      group = mapped;
    } else if (request.method === "GET" && url.pathname === "/v1/dap") {
      const lang = url.searchParams.get("lang") || "cpp";
      const mapped = LANG_TO_GROUP[lang];
      if (!mapped || !POC_DEBUG_LANGS.includes(lang)) {
        return jsonRes({ error: "这门语言不能在云端调试" }, 400);
      }
      group = mapped;
    } else {
      return jsonRes({ error: "没有这个接口" }, 404);
    }

    try {
      const ns = bindingForGroup(env, group);
      const stub = ns.get(ns.idFromName(`${auth.user}:${group}`));
      const headers = new Headers(request.headers);
      headers.set("x-cf-group", group);
      const fwd = new Request(request.url, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : bodyBuf,
      });
      return await stub.fetch(fwd);
    } catch (err) {
      return jsonRes(
        {
          error: err instanceof Error ? err.message : String(err),
          group,
        },
        500,
      );
    }
  },
};

export class RunnerContainerDO extends DurableObject<Env> {
  protected readonly group: RunnerGroup = "script";
  private starting: Promise<{ coldStart: boolean; bootMs: number }> | null = null;
  private monitoring = false;

  private sleepMs(): number {
    const n = Number(this.env.CONTAINER_SLEEP_MS || "120000");
    return Number.isFinite(n) && n >= 10000 ? n : 120000;
  }

  private container(): ContainerBinding {
    const c = (this.ctx as unknown as DOStateLike).container;
    if (!c) throw new Error("Durable Object container binding unavailable");
    return c;
  }

  private async touchIdleAlarm() {
    const state = this.ctx as unknown as DOStateLike;
    await state.storage.setAlarm(Date.now() + this.sleepMs());
  }

  async alarm(): Promise<void> {
    const c = (this.ctx as unknown as DOStateLike).container;
    if (c?.running) {
      await c.destroy().catch(() => {});
    }
  }

  private observeMonitor(c: ContainerBinding) {
    if (this.monitoring) return;
    this.monitoring = true;
    const state = this.ctx as unknown as DOStateLike;
    state.waitUntil(
      c.monitor().catch(() => {}).finally(() => {
        this.monitoring = false;
      }),
    );
  }

  private async ensureReady(): Promise<{ coldStart: boolean; bootMs: number }> {
    const c = this.container();
    if (this.starting) return this.starting;

    const alreadyRunning = c.running;
    if (alreadyRunning) {
      await this.touchIdleAlarm();
      try {
        const fast = await c.getTcpPort(CONTAINER_PORT).fetch("http://container/healthz");
        if (fast.ok) return { coldStart: false, bootMs: 0 };
      } catch {
        // Fall through to full readiness loop if container just started or restarted.
      }
    }

    this.starting = (async () => {
      const t0 = Date.now();
      if (!c.running) {
        c.start({
          enableInternet: false,
          env: {
            RUNNER_NODE_ID: this.env.RUNNER_NODE_ID || "cf-poc",
            RUNNER_SECRET: this.env.RUNNER_SECRET || "",
            RUNNER_HOST: "0.0.0.0",
            RUNNER_PORT: String(CONTAINER_PORT),
            RUNNER_DRIVER: "local",
            RUNNER_ALLOW_LOCAL: "1",
            RUNNER_SLOTS: "4",
            RUNNER_USER_PER_MIN: "60",
            RUNNER_PREPARED: "/opt/lc/prepared",
            RUNNER_WORK: "/work",
          },
        });
        this.observeMonitor(c);
        await c.setInactivityTimeout?.(this.sleepMs());
      }
      await this.touchIdleAlarm();

      const port = c.getTcpPort(CONTAINER_PORT);
      let lastErr = "container /healthz not ready";
      for (let i = 0; i < 300; i++) {
        try {
          const h = await port.fetch("http://container/healthz");
          if (h.ok) {
            return { coldStart: !alreadyRunning, bootMs: Date.now() - t0 };
          }
          lastErr = `HTTP ${h.status}`;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`容器启动超时 (${this.group}): ${lastErr}`);
    })().finally(() => {
      this.starting = null;
    });

    return this.starting;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const boot = await this.ensureReady();
      await this.touchIdleAlarm();

      const port = this.container().getTcpPort(CONTAINER_PORT);
      const containerUrl = request.url.replace(/^https:/, "http:");
      const upstream = await port.fetch(containerUrl, request);

      if (upstream.webSocket) {
        const containerWs = upstream.webSocket;
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        containerWs.accept();
        server.accept();
        server.addEventListener("message", (event) => {
          void this.touchIdleAlarm();
          try {
            containerWs.send(event.data);
          } catch {
            server.close(1011, "Container WebSocket forward error");
          }
        });
        containerWs.addEventListener("message", (event) => {
          void this.touchIdleAlarm();
          try {
            server.send(event.data);
          } catch {
            containerWs.close(1011, "Client WebSocket forward error");
          }
        });
        server.addEventListener("close", (event) => {
          const code = event.code === 1005 || event.code === 1006 ? 1000 : event.code;
          containerWs.close(code, event.reason);
        });
        containerWs.addEventListener("close", (event) => {
          const code = event.code === 1005 || event.code === 1006 ? 1000 : event.code;
          server.close(code, event.reason);
        });
        server.addEventListener("error", () => containerWs.close(1011, "Client WebSocket error"));
        containerWs.addEventListener("error", () => server.close(1011, "Container WebSocket error"));
        return new Response(null, {
          status: upstream.status,
          webSocket: client,
          headers: upstream.headers,
        });
      }

      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/v1/run" && upstream.ok) {
        const data = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
        if (data && typeof data === "object") {
          return jsonRes(
            {
              ...data,
              cfGroup: this.group,
              cfColdStart: boot.coldStart,
              cfContainerBootMs: boot.bootMs,
            },
            upstream.status,
          );
        }
      }
      return upstream;
    } catch (err) {
      return jsonRes(
        {
          error: err instanceof Error ? err.message : String(err),
          group: this.group,
        },
        500,
      );
    }
  }
}

export class RunnerScriptDO extends RunnerContainerDO {
  protected readonly group: RunnerGroup = "script";
}

export class RunnerJvmDO extends RunnerContainerDO {
  protected readonly group: RunnerGroup = "jvm";
}

export class RunnerNativeDO extends RunnerContainerDO {
  protected readonly group: RunnerGroup = "native";
}
