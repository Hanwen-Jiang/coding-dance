// 网站调用远端运行器集群：签名和 tools/runner/lib/sign.mjs 一致；起两个本机的运行器节点，测挑节点、固定节点、换节点。
// 运行：node functions/_lib/test/runner.test.ts（在 site/ 里）
import assert from "node:assert/strict";
import { callNode, forgetNodes, nodeFits, nodeStatuses, parseNodes, pickOrder, runOnCluster, sha256, sign } from "../runner.ts";

// tools/runner/test/server.test.mjs 用同一组输入算出的签名
const fixed = await sign("k".repeat(32), { method: "post", path: "/v1/run", time: 1700000000, nonce: "abcdefabcdefabcdef", user: "octocat", node: "lou1", bodyHash: await sha256('{"a":1}') });
assert.equal(fixed, "b2b038630a930c64fc00723773ca316ad21faf9e8abc4e138d3e6e3c54b27b2b");
console.log("✓ 签名和运行器那边一致");

assert.deepEqual(parseNodes(" lou1=https://run-lou1.codingdance.cn/ , bad , X=https://x, lou2=http://10.0.0.2:8790,lou1=https://dup"), [
  { id: "lou1", url: "https://run-lou1.codingdance.cn" },
  { id: "lou2", url: "http://10.0.0.2:8790" },
]);
console.log("✓ 节点表：写错的、重复的跳过");

// 固定节点：同一个用户总是先去同一个节点；加一个节点只挪动一部分用户；容量大的分到的用户多
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

const { createServer } = await import("../../../../tools/runner/server.mjs");
const { LocalDriver } = await import("../../../../tools/runner/lib/sandbox.mjs");
const secret = "s".repeat(40);
const start = async (node: string, over: Record<string, unknown> = {}) => {
  const server = createServer({ node, secret, perMinute: 50, slots: 2, queue: 2, caseMs: 3000, totalMs: 20000, jobMs: 60000, version: "test", ...over }, new LocalDriver());
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return { server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
};
const A = await start("lou1"), B = await start("lou2"), FULL = await start("lou3", { slots: 0, queue: 0 });
// 假节点：状态说自己空闲，真去跑却返回 503；沙箱是旧版的（报了 typescript，但 features 里没有 ts-transform）
const http = await import("node:http");
const stubServer = http.createServer((req, res) => {
  res.writeHead(req.url === "/v1/status" ? 200 : 503, { "content-type": "application/json" });
  res.end(JSON.stringify(req.url === "/v1/status" ? { node: "lou4", langs: ["python", "typescript"], slots: 2, queue: 2, busy: 0, queued: 0 } : { error: "满了" }));
});
await new Promise<void>((r) => stubServer.listen(0, "127.0.0.1", () => r()));
const STUB = { server: stubServer, url: `http://127.0.0.1:${(stubServer.address() as { port: number }).port}` };
const body = JSON.stringify({ lang: "python", mode: "acm", code: "print(sum(map(int, input().split())))\n", cases: [{ stdin: "20 22" }] });
try {
  const env = { RUNNER_NODES: `lou1=${A.url},lou2=${B.url}`, RUNNER_SECRET: secret };
  forgetNodes();
  const statuses = await nodeStatuses(env);
  assert.equal(statuses.get("lou1")?.node, "lou1");
  assert.equal(statuses.get("lou2")?.slots, 2);

  // 签给 lou1 的请求发到 lou2 不认
  const wrong = await callNode(env, { id: "lou1", url: B.url }, "GET", "/v1/status", "");
  assert.equal(wrong.status, 401);
  const badKey = await callNode({ ...env, RUNNER_SECRET: "x".repeat(40) }, { id: "lou1", url: A.url }, "GET", "/v1/status", "");
  assert.equal(badKey.status, 401);
  console.log("✓ 节点编号、密钥不对的请求不认");

  // 同一个用户两次落在同一个节点
  const r1 = await runOnCluster(env, "octocat", body, { lang: "python" });
  const r2 = await runOnCluster(env, "octocat", body, { lang: "python" });
  const d1 = (await r1.res!.json()) as { node: string; results: { stdout: string }[] }, d2 = (await r2.res!.json()) as { node: string };
  assert.equal(d1.results[0].stdout.trim(), "42");
  assert.equal(d1.node, d2.node);
  assert.equal(d1.node, pickOrder(parseNodes(env.RUNNER_NODES), "octocat")[0].id);
  console.log(`✓ 跑一次，同一个用户固定在 ${d1.node}`);

  // 他的节点满了：状态里看得出来（忙且排队排满）就直接去下一个，不用先碰一次壁
  forgetNodes();
  const fullFirst = { RUNNER_NODES: `lou3=${FULL.url},lou1=${A.url}`, RUNNER_SECRET: secret };
  const users = Array.from({ length: 40 }, (_, i) => "u" + i);
  const victim = users.find((u) => pickOrder(parseNodes(fullFirst.RUNNER_NODES), u)[0].id === "lou3")!;
  const r3 = await runOnCluster(fullFirst, victim, body, { lang: "python" });
  assert.equal(((await r3.res!.json()) as { node: string }).node, "lou1");
  assert.deepEqual(r3.tried, ["lou1"]);
  console.log("✓ 固定的节点状态显示满了，直接去下一个");

  // 沙箱还是旧版的节点（features 里没有 ts-transform）：TypeScript 排到后面，Python 照常
  forgetNodes();
  const oldEnv = { RUNNER_NODES: `lou4=${STUB.url},lou1=${A.url}`, RUNNER_SECRET: secret };
  await nodeStatuses(oldEnv);
  const onOld = users.find((u) => pickOrder(parseNodes(oldEnv.RUNNER_NODES), u, { lang: "python" })[0].id === "lou4")!;
  assert.equal(pickOrder(parseNodes(oldEnv.RUNNER_NODES), onOld, { lang: "typescript" })[0].id, "lou1");
  assert.equal(nodeFits({ langs: ["typescript"] }, "typescript"), false);
  assert.equal(nodeFits({ langs: ["typescript"], features: ["ts-transform"] }, "typescript"), true);
  assert.equal(nodeFits({ langs: ["python"] }, "python"), true);
  console.log("✓ 沙箱还是旧版的节点不接 TypeScript（排到后面），别的语言照常");

  // 状态还显示空闲、真去跑时才返回 503（刚满）：换下一个，并且几秒内先不找它
  forgetNodes();
  const stubEnv = { RUNNER_NODES: `lou4=${STUB.url},lou1=${A.url}`, RUNNER_SECRET: secret };
  const unlucky = users.find((u) => pickOrder(parseNodes(stubEnv.RUNNER_NODES), u)[0].id === "lou4")!;
  const r5 = await runOnCluster(stubEnv, unlucky, body, { lang: "python" });
  assert.equal(((await r5.res!.json()) as { node: string }).node, "lou1");
  assert.deepEqual(r5.tried, ["lou4", "lou1"]);
  assert.equal(pickOrder(parseNodes(stubEnv.RUNNER_NODES), unlucky)[0].id, "lou1");
  console.log("✓ 去跑时才发现满了（503），换下一个");

  // 节点下线：跳过它；全都不在线：返回 null
  forgetNodes();
  const deadUrl = B.url;
  await new Promise<void>((r) => B.server.close(() => r()));
  const withDead = { RUNNER_NODES: `lou2=${deadUrl},lou1=${A.url}`, RUNNER_SECRET: secret };
  const deadFirst = users.find((u) => pickOrder(parseNodes(withDead.RUNNER_NODES), u)[0].id === "lou2")!;
  const r4 = await runOnCluster(withDead, deadFirst, body, { lang: "python" });
  assert.equal(((await r4.res!.json()) as { node: string }).node, "lou1");
  assert.equal(pickOrder(parseNodes(withDead.RUNNER_NODES), deadFirst)[0].id, "lou1", "知道 lou2 下线后先去 lou1");
  forgetNodes();
  const none = await runOnCluster({ RUNNER_NODES: `lou2=${deadUrl}`, RUNNER_SECRET: secret }, "octocat", body);
  assert.equal(none.res, null);
  console.log("✓ 节点下线了跳过，全都不在线时报错");
} finally {
  A.server.close();
  B.server.close();
  FULL.server.close();
  STUB.server.close();
}
