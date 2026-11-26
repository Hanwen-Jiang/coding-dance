// 测试用的假 fc-manager：接口和 agent-runtime 的 fc-manager 一样（建环境、转给客户机 agent 的 exec、销毁），
// exec 直接在本机跑命令（不隔离）。用来在没有 KVM 的机器上测 FirecrackerDriver 的协议；真 microVM 在 CI 的「Firecracker」任务里测。
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_SANDBOX = path.join(path.dirname(fileURLToPath(import.meta.url)), "../sandbox/sandbox.js");

export function startFakeFcManager({ token, owner = "lc-hot100", maxVms = 4 } = {}) {
  const envs = new Map(), log = [];
  const reply = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://fc");
    if (url.pathname === "/healthz") return reply(res, 200, { ok: true });
    if (req.headers.authorization !== `Bearer ${token}`) return reply(res, 401, { code: "unauthenticated", message: "令牌不对" });
    const who = req.headers["x-sandbox-owner"];
    let body = "";
    for await (const c of req) body += c;
    log.push(`${req.method} ${url.pathname}`);
    if (req.method === "POST" && url.pathname === "/v1/envs") {
      const spec = JSON.parse(body);
      if (envs.size >= maxVms) return reply(res, 503, { code: "host_capacity", message: "宿主容量满了" });
      const id = "env-" + crypto.randomBytes(6).toString("hex");
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-fc-"));
      envs.set(id, { owner: who, spec, dir });
      return reply(res, 201, { env_id: id, runtime: spec.runtime });
    }
    const m = url.pathname.match(/^\/v1\/envs\/([\w-]+)(\/agent\/v1\/exec)?$/);
    const env = m && envs.get(m[1]);
    if (!env || env.owner !== who) return reply(res, 404, { code: "not_found", message: "没有这个环境" });
    if (req.method === "DELETE" && !m[2]) {
      fs.rmSync(env.dir, { recursive: true, force: true });
      envs.delete(m[1]);
      res.writeHead(204); return res.end();
    }
    if (req.method === "POST" && m[2]) {
      const r = JSON.parse(body);
      for (const k of ["argv", "stdin", "timeout_ms", "env", "exec_id", "offload_inline_bytes"]) if (!(k in r)) return reply(res, 400, { code: "invalid_request", message: "缺 " + k });
      // 客户机里的 /workspace 换成这个环境自己的目录；node 就用跑测试的这个
      const argv = r.argv.map((a) => (a === "node" ? process.execPath : a === "/opt/lc/tools/runner/sandbox/sandbox.js" ? LOCAL_SANDBOX : a));
      // 客户机里的路径和工具名换成本机的（Windows 上 python3 是个什么都不做的占位程序）
      const guestEnv = { ...r.env, RUNNER_WORK: env.dir };
      delete guestEnv.RUNNER_PREPARED;
      if (process.platform === "win32") delete guestEnv.PYTHON;
      const child = spawn(argv[0], argv.slice(1), { env: { ...process.env, ...guestEnv }, stdio: ["pipe", "pipe", "pipe"] });
      const out = [], err = [];
      let timedOut = false;
      const t = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, r.timeout_ms);
      child.stdout.on("data", (b) => out.push(b));
      child.stderr.on("data", (b) => err.push(b));
      child.stdin.end(Buffer.from(r.stdin, "base64"));
      child.on("close", (code) => {
        clearTimeout(t);
        reply(res, 200, { exit_code: timedOut ? null : code, timed_out: timedOut, stdout: Buffer.concat(out).toString("base64"), stderr: Buffer.concat(err).toString("base64") });
      });
      return;
    }
    return reply(res, 404, { code: "not_found", message: "没有这个接口" });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}`, envs, log })));
}
