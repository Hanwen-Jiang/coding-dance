// 在隔离环境里跑一次沙箱（sandbox/sandbox.js）：
//   docker：生产用。预先起好几个空容器（池），来一个任务用一个，用完 docker rm -f，再补一个新的。容器不能上网、根文件系统只读、
//           限内存 / CPU / 进程数 / 文件大小、去掉所有特权、用普通用户跑；可以换成 gVisor（runsc）或 Kata（每个容器一台小虚拟机）。
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
