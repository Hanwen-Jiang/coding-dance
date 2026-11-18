// 在隔离环境里跑一次沙箱（sandbox/sandbox.js）：
//   firecracker：生产用。每次运行一台全新的 Firecracker microVM（自己的内核，没有网卡），用完就销毁。VM 由 agent-runtime 的
//           fc-manager 管（jailer：每台 VM 一个 uid、chroot、独立命名空间、cgroup v2 上限、seccomp；预热池），
//           沙箱程序经客户机里的 sandbox-agent 执行。见 README「Firecracker」。
//   docker：开发和 CI 用。预先起好几个空容器，来一个任务用一个，用完 docker rm -f。容器不能上网、根文件系统只读、限内存 / CPU /
//           进程数、去掉所有特权、普通用户；但和宿主共用一个内核，内核漏洞就能逃出来，**不能在生产上跑公开用户的代码**。
//   local：本机开发用，直接在本机跑，**不隔离**，只能在自己的机器上用。
import { spawn, execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SANDBOX_IN_IMAGE = "/opt/lc/tools/runner/sandbox/sandbox.js";
const LOCAL_SANDBOX = path.join(path.dirname(fileURLToPath(import.meta.url)), "../sandbox/sandbox.js");

/** 起一个空容器的参数（测试里也用这一份，保证和线上一样） */
export function dockerRunArgs({ image, name, runtime = "", memory = "1g", cpus = "1", pids = 256 }) {
  return [
    "run", "-d", "--name", name, "--label", "lc-runner=1",
    "--network", "none", "--read-only",
    "--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=128m,mode=1777",
    "--tmpfs", "/work:rw,exec,nosuid,nodev,size=256m,mode=1777",
    "--memory", memory, "--memory-swap", memory, "--cpus", String(cpus), "--pids-limit", String(pids),
    "--ulimit", "nofile=512:512", "--ulimit", "fsize=134217728:134217728", "--ulimit", "core=0",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "10001:10001",
    ...(runtime ? ["--runtime", runtime] : []),
    image, "sleep", "infinity",
  ];
}

const sh = (file, args, timeout = 60000) => new Promise((resolve, reject) => {
  execFile(file, args, { timeout, maxBuffer: 1 << 20 }, (err, stdout, stderr) => (err ? reject(new Error(String(stderr || err.message).trim())) : resolve(String(stdout).trim())));
});

/** 把任务写进一个进程的标准输入，读它标准输出里的 JSON */
function pipeJob(file, args, input, timeoutMs, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(file, args, { stdio: ["pipe", "pipe", "pipe"], ...opts });
    const out = [];
    let size = 0, err = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (b) => { size += b.length; if (size <= 32 << 20) out.push(b); else child.kill("SIGKILL"); });
    child.stderr.on("data", (b) => { err = (err + b).slice(-4000); });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, error: "启动沙箱失败：" + e.message }); });
    child.on("close", () => {
      clearTimeout(timer);
      if (timedOut) return resolve({ ok: false, error: "这次运行超过了总时间限制，被停下了" });
      const text = Buffer.concat(out).toString("utf8");
      try { resolve({ ok: true, json: JSON.parse(text) }); } catch { resolve({ ok: false, error: "沙箱没有返回结果" + (err ? "：" + err.trim().split("\n").slice(-3).join(" | ") : "") }); }
    });
  });
}

export class DockerPool {
  constructor({ image, size = 2, runtime = "", memory, cpus, pids, log = () => {} }) {
    Object.assign(this, { image, size, runtime, memory, cpus, pids, log });
    this.ready = [];
    this.starting = 0;
    this.failures = 0;
    this.closed = false;
  }

  async init() {
    await sh("docker", ["image", "inspect", this.image]).catch(() => { throw new Error(`没有镜像 ${this.image}：先在虚拟机里构建（见 tools/runner/README.md）`); });
    await this.cleanup();
    this.fill();
  }

  /** 上次没删掉的容器（服务被强行停掉时留下的） */
  async cleanup() {
    const ids = (await sh("docker", ["ps", "-aq", "--filter", "label=lc-runner=1"]).catch(() => "")).split(/\s+/).filter(Boolean);
    if (ids.length) await sh("docker", ["rm", "-f", ...ids]).catch(() => {});
  }

  async create() {
    const name = "lcr-" + crypto.randomBytes(6).toString("hex");
    await sh("docker", dockerRunArgs({ image: this.image, name, runtime: this.runtime, memory: this.memory, cpus: this.cpus, pids: this.pids }));
    return name;
  }

  fill() {
    while (!this.closed && this.failures < 5 && this.ready.length + this.starting < this.size) {
      this.starting++;
      this.create().then((name) => {
        this.failures = 0;
        if (this.closed) sh("docker", ["rm", "-f", name]).catch(() => {}); else this.ready.push(name);
      }, (e) => {
        this.failures++;
        this.log({ event: "pool-error", error: e.message });
      }).finally(() => {
        this.starting--;
        if (this.failures && this.failures < 5) setTimeout(() => this.fill(), 1000 * this.failures);
      });
    }
  }

  async run(input, timeoutMs) {
    this.failures = 0;
    const name = this.ready.shift() || await this.create();
    this.fill();
    try {
      return await pipeJob("docker", ["exec", "-i", name, "node", SANDBOX_IN_IMAGE], input, timeoutMs);
    } finally {
      sh("docker", ["rm", "-f", name]).catch((e) => this.log({ event: "rm-error", error: e.message }));
    }
  }

  status() { return { driver: "docker", ready: this.ready.length, starting: this.starting, runtime: this.runtime || "runc" }; }

  async close() {
    this.closed = true;
    await this.cleanup();
  }
}

/**
 * Firecracker：agent-runtime 的 fc-manager（services/rs-fc-manager）的 HTTP 接口：
 *   POST   /v1/envs                         {"runtime", "cpu_millis", "memory_mb", "labels"} → 201 {"env_id"}（预热池里有就直接交出一台）
 *   POST   /v1/envs/<id>/agent/v1/exec      转给客户机里的 sandbox-agent：{"argv", "stdin"(base64), "timeout_ms", "env", "exec_id", "offload_inline_bytes"}
 *                                            → {"exit_code", "timed_out", "stdout"(base64), "stderr"(base64)}
 *   DELETE /v1/envs/<id>                    销毁
 * 认证：Authorization: Bearer <令牌>（fc-manager 的 SecretStore 文件里 _platform 作用域的 sandbox/fc-manager-token），X-Sandbox-Owner。
 * 客户机的根文件系统是这个镜像转成的只读盘（agent-runtime 的 rootfs.sh），可写的只有 /workspace 和 /tmp；命令以 uid 10001 跑，
 * 只拿到 PATH、HOME、LANG 这几个环境变量，其余的（RUNNER_WORK 这些）每次随请求给。
 */
export class FirecrackerDriver {
  constructor({ url = "http://127.0.0.1:8097", tokenFile = "", token = "", owner = "lc-hot100", runtime = "lc-runner", cpuMillis = 1000, memoryMb = 1024, log = () => {} } = {}) {
    Object.assign(this, { url: url.replace(/\/+$/, ""), tokenFile, fixedToken: token, owner, runtime, cpuMillis, memoryMb, log });
    this.live = 0;
  }

  /** 每次都重新读：fc-manager 换令牌不用重启，这里也跟着换 */
  token() {
    if (this.fixedToken) return this.fixedToken;
    const file = JSON.parse(fs.readFileSync(this.tokenFile, "utf8"));
    const t = file?.scopes?._platform?.secrets?.["sandbox/fc-manager-token"];
    if (!t) throw new Error(`${this.tokenFile} 里没有 _platform 作用域的 sandbox/fc-manager-token`);
    return t;
  }

  async call(method, path, body, timeoutMs = 30000) {
    const res = await fetch(this.url + path, {
      method,
      headers: { authorization: `Bearer ${this.token()}`, "x-sandbox-owner": this.owner, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* 下面按状态码说 */ }
    return { status: res.status, json, text };
  }

  async init() {
    const h = await fetch(this.url + "/healthz").catch((e) => { throw new Error(`连不上 fc-manager（${this.url}）：${e.message}`); });
    if (!h.ok) throw new Error(`fc-manager 的 /healthz 返回 ${h.status}`);
    this.token();
  }

  async run(input, timeoutMs) {
    const t0 = Date.now();
    let created;
    try {
      created = await this.call("POST", "/v1/envs", { runtime: this.runtime, cpu_millis: this.cpuMillis, memory_mb: this.memoryMb, labels: { app: "lc-hot100" } });
    } catch (e) {
      return { ok: false, error: "连不上 fc-manager：" + e.message };
    }
    if (created.status === 503) return { ok: false, busy: true, error: "这台机器上的 microVM 满了" };
    if (created.status !== 201 || !created.json?.env_id) return { ok: false, error: `建 microVM 失败（${created.status}）：${created.json?.message || created.text.slice(0, 200)}` };
    const id = created.json.env_id;
    this.live++;
    const bootMs = Date.now() - t0;
    try {
      const r = await this.call("POST", `/v1/envs/${id}/agent/v1/exec`, {
        argv: ["node", SANDBOX_IN_IMAGE],
        stdin: Buffer.from(input).toString("base64"),
        timeout_ms: timeoutMs,
        env: { RUNNER_WORK: "/workspace", RUNNER_PREPARED: "/opt/lc/prepared", PYTHON: "python3", GOTOOLCHAIN: "local", CGO_ENABLED: "0" },
        exec_id: crypto.randomUUID(),
        offload_inline_bytes: 0,
      }, timeoutMs + 15000);
      if (r.status !== 200 || !r.json) return { ok: false, error: `microVM 里执行失败（${r.status}）：${r.json?.message || r.text.slice(0, 200)}` };
      if (r.json.timed_out) return { ok: false, error: "这次运行超过了总时间限制，被停下了" };
      const stdout = Buffer.from(r.json.stdout || "", "base64").toString("utf8");
      try {
        return { ok: true, json: JSON.parse(stdout), bootMs };
      } catch {
        const stderr = Buffer.from(r.json.stderr || "", "base64").toString("utf8");
        return { ok: false, error: `沙箱没有返回结果（退出码 ${r.json.exit_code}）` + (stderr ? "：" + stderr.trim().split("\n").slice(-3).join(" | ") : "") };
      }
    } catch (e) {
      return { ok: false, error: "microVM 里执行出错：" + e.message };
    } finally {
      this.live--;
      // 用完就销毁（没了也是 204）；失败了 fc-manager 的回收器和重启时的清扫会兜底
      this.call("DELETE", `/v1/envs/${id}`, null, 30000).then((d) => { if (d.status !== 204) this.log({ event: "fc-delete", env: id, status: d.status }); }, (e) => this.log({ event: "fc-delete", env: id, error: e.message }));
    }
  }

  status() { return { driver: "firecracker", runtime: this.runtime, live: this.live }; }
  async close() {}
}

/** 本机开发：不隔离 */
export class LocalDriver {
  async init() {}
  async run(input, timeoutMs) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "lc-runner-"));
    try {
      return await pipeJob(process.execPath, [LOCAL_SANDBOX], input, timeoutMs, { env: { ...process.env, RUNNER_WORK: work } });
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
  status() { return { driver: "local", ready: 0, starting: 0 }; }
  async close() {}
}

/** 测试用：每个任务起一个容器跑完就删（参数和池里的一样） */
export async function runInFreshContainer(image, input, { timeoutMs = 120000, runtime = "" } = {}) {
  const pool = new DockerPool({ image, size: 0, runtime });
  return pool.run(input, timeoutMs);
}
