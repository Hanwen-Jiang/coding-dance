// 网站调用远端运行器集群（真实 Go 单二进制 cd-runner 进程）：
// 验证签名一致、挑节点、固定节点、换节点、DAP WebSocket 签名地址与 #/admin 集群遥测聚合。
// 运行：node functions/_lib/test/runner.test.ts（在 site/ 里）
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  callNode,
  clusterTelemetry,
  forgetNodes,
  nodeFits,
  nodeStatuses,
  parseNodes,
  pickOrder,
  runOnCluster,
  sha256,
  sign,
  signedDapUrl,
} from "../runner.ts";
import { onRequestGet as adminRunnerGet } from "../../api/admin/runner.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

// 固定向量核对（与 internal/runner/runner_test.go 一致）
const fixed = await sign("k".repeat(32), { method: "post", path: "/v1/run", time: 1700000000, nonce: "abcdefabcdefabcdef", user: "octocat", node: "lou1", bodyHash: await sha256('{"a":1}') });
assert.equal(fixed, "b2b038630a930c64fc00723773ca316ad21faf9e8abc4e138d3e6e3c54b27b2b");
console.log("✓ 签名和 cd-runner 算法一致");

assert.deepEqual(parseNodes(" lou1=https://run-lou1.codingdance.cn/ , bad , X=https://x, lou2=http://10.0.0.2:8790,lou1=https://dup"), [
  { id: "lou1", url: "https://run-lou1.codingdance.cn" },
  { id: "lou2", url: "http://10.0.0.2:8790" },
]);
console.log("✓ 节点表：写错的、重复的跳过");

{
  forgetNodes();
  const two = parseNodes("a=http://a,b=http://b"), three = parseNodes("a=http://a,b=http://b,c=http://c");
  const users = Array.from({ length: 600 }, (_, i) => "user" + i);
  const first = (nodes: typeof two, u: string) => pickOrder(nodes, u)[0].id;
  assert.ok(users.every((u) => first(two, u) === first(two, u)));
  const moved = users.filter((u) => first(two, u) !== first(three, u));
  assert.ok(moved.every((u) => first(three, u) === "c"), "加节点时只会挪到新节点上");
  assert.ok(moved.length > 120 && moved.length < 280, `挪动的用户应该约 1/3，实际 ${moved.length}`);
  const share = users.filter((u) => first(two, u) === "a").length;
  assert.ok(share > 230 && share < 370, `两个节点应该各分一半，a 分到 ${share}`);
  console.log(`✓ 固定节点：加一个节点挪动 ${moved.length}/600 个用户，都挪到新节点`);
}

// 编译真实的 Go cd-runner 二进制并拉起集群节点
const runnerBin = path.join(os.tmpdir(), `cd-runner-site-${process.pid}${process.platform === "win32" ? ".exe" : ""}`);
const built = spawnSync("go", ["build", "-o", runnerBin, "./cmd/cd-runner"], { cwd: repoRoot, encoding: "utf8", env: { ...process.env, CGO_ENABLED: "0" } });
if (built.status !== 0) throw new Error("编译 cd-runner 失败：\n" + (built.stderr || built.stdout));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
    s.on("error", reject);
  });
}

const secret = "s".repeat(40);
async function startGoNode(node: string, extraEnv: Record<string, string> = {}) {
  const port = await freePort();
  const proc = spawn(runnerBin, [], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      RUNNER_NODE_ID: node,
      RUNNER_HOST: "127.0.0.1",
      RUNNER_PORT: String(port),
      RUNNER_SECRET: secret,
      RUNNER_DRIVER: "local",
      RUNNER_ALLOW_LOCAL: "1",
      RUNNER_SLOTS: "2",
      RUNNER_QUEUE: "2",
      RUNNER_USER_PER_MIN: "50",
      RUNNER_VERSION: "test-go",
      ...extraEnv,
    },
  });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url + "/healthz");
      if (r.ok) {
        return {
          proc,
          url,
          stop: () =>
            new Promise<void>((res) => {
              if (proc.exitCode !== null || proc.signalCode !== null) return res();
              proc.once("exit", () => res());
              proc.kill("SIGTERM");
            }),
        };
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`cd-runner 节点 ${node} 启动超时`);
}

const A = await startGoNode("lou1"), B = await startGoNode("lou2");
// 假满载节点与旧版沙箱桩节点
const fullServer = http.createServer((req, res) => {
  res.writeHead(req.url === "/v1/status" ? 200 : 503, { "content-type": "application/json" });
  res.end(JSON.stringify(req.url === "/v1/status" ? { node: "lou3", langs: ["python"], slots: 1, queue: 0, busy: 1, queued: 0 } : { error: "满了" }));
});
await new Promise<void>((r) => fullServer.listen(0, "127.0.0.1", () => r()));
const FULL = { server: fullServer, url: `http://127.0.0.1:${(fullServer.address() as net.AddressInfo).port}` };

const stubServer = http.createServer((req, res) => {
  res.writeHead(req.url === "/v1/status" ? 200 : 503, { "content-type": "application/json" });
  res.end(JSON.stringify(req.url === "/v1/status" ? { node: "lou4", langs: ["python", "typescript"], slots: 2, queue: 2, busy: 0, queued: 0 } : { error: "满了" }));
});
await new Promise<void>((r) => stubServer.listen(0, "127.0.0.1", () => r()));
const STUB = { server: stubServer, url: `http://127.0.0.1:${(stubServer.address() as net.AddressInfo).port}` };

const body = JSON.stringify({ lang: "python", mode: "acm", code: "print(sum(map(int, input().split())))\n", cases: [{ stdin: "20 22" }] });

try {
  const env = { RUNNER_NODES: `lou1=${A.url},lou2=${B.url}`, RUNNER_SECRET: secret };
  forgetNodes();
  const statuses = await nodeStatuses(env);
  assert.equal(statuses.get("lou1")?.node, "lou1");
  assert.equal(statuses.get("lou2")?.slots, 2);
  assert.ok(statuses.get("lou1")?.features?.includes("dap-ws"));
  assert.ok(statuses.get("lou1")?.features?.includes("otel-metrics"));

  // 签给 lou1 的请求发到 lou2 不认
  const wrong = await callNode(env, { id: "lou1", url: B.url }, "GET", "/v1/status", "");
  assert.equal(wrong.status, 401);
  const badKey = await callNode({ ...env, RUNNER_SECRET: "x".repeat(40) }, { id: "lou1", url: A.url }, "GET", "/v1/status", "");
  assert.equal(badKey.status, 401);
  console.log("✓ 节点编号、密钥不对的请求不认");

  // 同一个用户两次落在同一个 cd-runner 节点
  const r1 = await runOnCluster(env, "octocat", body, { lang: "python" });
  const r2 = await runOnCluster(env, "octocat", body, { lang: "python" });
  const d1 = (await r1.res!.json()) as { node: string; results: { stdout: string }[] }, d2 = (await r2.res!.json()) as { node: string };
  assert.equal(d1.results[0].stdout.trim(), "42");
  assert.equal(d1.node, d2.node);
  assert.equal(d1.node, pickOrder(parseNodes(env.RUNNER_NODES), "octocat")[0].id);
  console.log(`✓ 跑一次，同一个用户固定在 ${d1.node}`);

  // #/admin 集群联合监控遥测聚合接口校验
  const unauthAdmin = await adminRunnerGet({ request: new Request("https://codingdance.cn/api/admin/runner"), env });
  assert.equal(unauthAdmin.status, 401);
  const okAdmin = await adminRunnerGet({
    request: new Request("https://codingdance.cn/api/admin/runner", { headers: { Authorization: `Bearer ${secret}` } }),
    env,
  });
  assert.equal(okAdmin.status, 200);
  const telData = await clusterTelemetry(env);
  assert.equal(telData.summary.onlineNodes, 2);
  assert.equal(telData.nodes[0].telemetry?.service, "cd-runner");
  console.log("✓ #/admin 集群 OTel 遥测聚合接口正常（鉴权 + 多节点指标汇总）");

  // DAP 签名地址（含可选 lang 查询参数）与 dap-ws 节点筛选
  const dapUrl = await signedDapUrl(env, { id: "lou1", url: A.url }, "octocat");
  assert.match(dapUrl, /\/v1\/dap\?.*node=lou1/);
  const dapUrlWithLang = await signedDapUrl(env, { id: "lou1", url: A.url }, "octocat", Date.now(), "go");
  assert.match(dapUrlWithLang, /\/v1\/dap\?.*lang=go/);
  assert.equal(nodeFits({ langs: ["go"], debugLangs: ["go"], features: ["ts-transform"] }, "go", true, "dap-ws"), false);
  assert.equal(nodeFits({ langs: ["go"], debugLangs: ["go"], features: ["ts-transform", "dap-ws"] }, "go", true, "dap-ws"), true);

  // 冷缓存下异构节点返回 422 Unprocessable Entity 时无缝故障转移，且不把 422 节点标为下线
  const jdOnlyServer = http.createServer((req, res) => {
    if (req.url === "/v1/status") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ node: "jd1", langs: ["python"], debugLangs: ["python"], slots: 2, queue: 4, busy: 0, queued: 0 }));
      return;
    }
    res.writeHead(422, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "这个节点不支持这门语言" }));
  });
  await new Promise<void>((r) => jdOnlyServer.listen(0, "127.0.0.1", () => r()));
  const JD1 = `http://127.0.0.1:${(jdOnlyServer.address() as net.AddressInfo).port}`;
  try {
    forgetNodes();
    const heteroEnv = { RUNNER_NODES: `jd1=${JD1},lou1=${A.url}`, RUNNER_SECRET: secret };
    const heteroUsers = Array.from({ length: 40 }, (_, i) => "u" + i);
    const firstJd = heteroUsers.find((u) => pickOrder(parseNodes(heteroEnv.RUNNER_NODES), u)[0].id === "jd1")!;
    assert.ok(firstJd, "应能找到优先落在 jd1 的测试用户");
    const r422 = await runOnCluster(heteroEnv, firstJd, JSON.stringify({ lang: "rust", mode: "acm", code: "fn main(){}", cases: [{ stdin: "" }] }), { lang: "rust" });
    assert.equal(r422.res?.status, 200);
    assert.deepEqual(r422.tried, ["jd1", "lou1"]);
    // jd1 不应被 markDown，后续仍排在 python 默认顺序首位
    assert.equal(pickOrder(parseNodes(heteroEnv.RUNNER_NODES), firstJd, { lang: "python" })[0].id, "jd1");
    console.log("✓ 异构节点 422 Unprocessable Entity 无缝切换且不误判节点下线");
  } finally {
    jdOnlyServer.close();
    jdOnlyServer.closeAllConnections?.();
  }

  // 节点状态显示已满时直接去下一个
  forgetNodes();
  const fullFirst = { RUNNER_NODES: `lou3=${FULL.url},lou1=${A.url}`, RUNNER_SECRET: secret };
  const users = Array.from({ length: 40 }, (_, i) => "u" + i);
  const victim = users.find((u) => pickOrder(parseNodes(fullFirst.RUNNER_NODES), u)[0].id === "lou3")!;
  assert.ok(victim, "应能找到优先落在 lou3 的测试用户");
  await nodeStatuses(fullFirst);
  const r3 = await runOnCluster(fullFirst, victim, body, { lang: "python" });
  assert.equal(((await r3.res!.json()) as { node: string }).node, "lou1");
  assert.deepEqual(r3.tried, ["lou1"]);
  console.log("✓ 固定的节点状态显示满了，直接去下一个");

  // 沙箱还是旧版的节点不接 TypeScript
  forgetNodes();
  const oldEnv = { RUNNER_NODES: `lou4=${STUB.url},lou1=${A.url}`, RUNNER_SECRET: secret };
  await nodeStatuses(oldEnv);
  const onOld = users.find((u) => pickOrder(parseNodes(oldEnv.RUNNER_NODES), u, { lang: "python" })[0].id === "lou4")!;
  assert.equal(pickOrder(parseNodes(oldEnv.RUNNER_NODES), onOld, { lang: "typescript" })[0].id, "lou1");
  console.log("✓ 沙箱还是旧版的节点不接 TypeScript（排到后面），别的语言照常");

  // 真去跑时才返回 503，换下一个
  forgetNodes();
  const stubEnv = { RUNNER_NODES: `lou4=${STUB.url},lou1=${A.url}`, RUNNER_SECRET: secret };
  const unlucky = users.find((u) => pickOrder(parseNodes(stubEnv.RUNNER_NODES), u)[0].id === "lou4")!;
  const r5 = await runOnCluster(stubEnv, unlucky, body, { lang: "python" });
  assert.equal(((await r5.res!.json()) as { node: string }).node, "lou1");
  assert.deepEqual(r5.tried, ["lou4", "lou1"]);
  console.log("✓ 去跑时才发现满了（503），换下一个");

  // 节点下线跳过；全都不在线返回 null
  forgetNodes();
  const deadUrl = B.url;
  await B.stop();
  const withDead = { RUNNER_NODES: `lou2=${deadUrl},lou1=${A.url}`, RUNNER_SECRET: secret };
  const deadFirst = users.find((u) => pickOrder(parseNodes(withDead.RUNNER_NODES), u)[0].id === "lou2")!;
  const r4 = await runOnCluster(withDead, deadFirst, body, { lang: "python" });
  assert.equal(((await r4.res!.json()) as { node: string }).node, "lou1");
  forgetNodes();
  const none = await runOnCluster({ RUNNER_NODES: `lou2=${deadUrl}`, RUNNER_SECRET: secret }, "octocat", body);
  assert.equal(none.res, null);
  console.log("✓ 节点下线了跳过，全都不在线时报错");

  // 冷缓存下 runOnCluster 不阻塞等待慢速 /v1/status
  let slowStatusCalls = 0;
  let releaseStatus!: () => void;
  const statusGate = new Promise<void>((resolve) => { releaseStatus = resolve; });
  const slowServer = http.createServer(async (req, res) => {
    if (req.url === "/v1/status") {
      slowStatusCalls++;
      await Promise.race([statusGate, new Promise((r) => setTimeout(r, 1200))]);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ node: "slow1", langs: ["python"], slots: 4, queue: 10, busy: 0, queued: 0 }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, node: "slow1", results: [{ index: 0, stdout: "42\n", duration: 1 }] }));
  });
  await new Promise<void>((r) => slowServer.listen(0, "127.0.0.1", () => r()));
  const SLOW = { server: slowServer, url: `http://127.0.0.1:${(slowServer.address() as net.AddressInfo).port}` };
  try {
    forgetNodes();
    const tSingle = Date.now();
    const sRes = await runOnCluster({ RUNNER_NODES: `slow1=${SLOW.url}`, RUNNER_SECRET: secret }, "octocat", body, { lang: "python" });
    assert.equal(sRes.res?.status, 200);
    assert.ok(Date.now() - tSingle < 400, "单节点冷缓存不应阻塞在 /v1/status");
    assert.equal(slowStatusCalls, 0, "单节点 runOnCluster 不应请求 /v1/status");

    forgetNodes();
    const bg: Promise<unknown>[] = [];
    const tMulti = Date.now();
    const mRes = await runOnCluster(
      { RUNNER_NODES: `slow1=${SLOW.url},lou1=${A.url}`, RUNNER_SECRET: secret },
      "octocat",
      body,
      { lang: "python", waitUntil: (p) => bg.push(p) },
    );
    assert.equal(mRes.res?.status, 200);
    assert.ok(Date.now() - tMulti < 400, "多节点冷缓存也不应阻塞等待 /v1/status");
    releaseStatus();
    await Promise.all(bg);
    console.log("✓ 冷缓存下 /api/run 热路径不阻塞等待 /v1/status");
  } finally {
    releaseStatus();
    slowServer.close();
    slowServer.closeAllConnections?.();
  }
} finally {
  await A.stop().catch(() => {});
  await B.stop().catch(() => {});
  fullServer.close();
  fullServer.closeAllConnections?.();
  stubServer.close();
  stubServer.closeAllConnections?.();
  fs.rmSync(runnerBin, { force: true });
}
