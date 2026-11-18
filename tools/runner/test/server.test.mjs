// 服务的测试：签名（带节点编号）、防重放、参数检查、限流，以及经服务完整跑一次。
//   本机：node tools/runner/test/server.test.mjs（沙箱不隔离）；CI：RUNNER_TEST_IMAGE=lc-runner:ci（用容器池）
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { signedHeaders, verify, sign, sha256, NonceCache } from "../lib/sign.mjs";
import { createServer, validate, LANGS } from "../server.mjs";
import { DockerPool, LocalDriver } from "../lib/sandbox.mjs";

const { LANG_IDS } = createRequire(import.meta.url)("../sandbox/programs.js");

const SECRET = "test-secret-0123456789abcdef0123456789";
let failed = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓ " + name); } catch (e) { failed++; console.log("  ✗ " + name + "\n      " + String(e.stack || e).split("\n").slice(0, 5).join("\n      ")); }
}

/** 固定输入的签名：site/functions/_lib/test/runner.test.ts 用同一组输入，结果要一样 */
const FIXED = { secret: "k".repeat(32), method: "POST", path: "/v1/run", time: 1700000000, nonce: "abcdefabcdefabcdef", user: "octocat", node: "lou1", body: '{"a":1}' };

console.log("语言");
await test("服务报的语言和沙箱支持的一样（部署时只复制 server.mjs，所以两边各写一份）", () => {
  assert.deepEqual([...LANGS].sort(), [...LANG_IDS].sort());
});

console.log("签名");
await test("签名和网站那边的算法一致（固定输入的结果）", () => {
  const s = sign(FIXED.secret, { ...FIXED, method: "post", bodyHash: sha256(FIXED.body) });
  assert.equal(s, sign(FIXED.secret, { ...FIXED, time: String(FIXED.time), bodyHash: sha256(Buffer.from(FIXED.body)) }));
  assert.equal(s, "b2b038630a930c64fc00723773ca316ad21faf9e8abc4e138d3e6e3c54b27b2b");
});
await test("改了请求体、用户、时间、节点都通不过", () => {
  const body = '{"x":1}', h = signedHeaders(SECRET, { method: "POST", path: "/v1/run", node: "lou1", user: "alice", body });
  const ok = (over = {}) => verify(SECRET, { method: "POST", path: "/v1/run", headers: h, body, node: "lou1", ...over }).ok;
  assert.equal(ok(), true);
  assert.equal(ok({ body: '{"x":2}' }), false);
  assert.equal(ok({ headers: { ...h, "x-runner-user": "bob" } }), false);
  assert.equal(ok({ path: "/v1/status" }), false);
  assert.equal(ok({ now: Date.now() + 10 * 60000 }), false);
  assert.equal(verify("another-secret-0123456789abcdef012345", { method: "POST", path: "/v1/run", headers: h, body, node: "lou1" }).ok, false);
  // 集群里共用一个密钥：签给 lou1 的拿到 lou2 上不认；把头里的节点改成 lou2 签名也对不上
  assert.match(verify(SECRET, { method: "POST", path: "/v1/run", headers: h, body, node: "lou2" }).reason, /发给节点 lou1/);
  assert.equal(verify(SECRET, { method: "POST", path: "/v1/run", headers: { ...h, "x-runner-node": "lou2" }, body, node: "lou2" }).reason, "签名不对");
});
await test("同一个请求不能用两次", () => {
  const nonces = new NonceCache(), body = "{}", h = signedHeaders(SECRET, { method: "POST", path: "/v1/run", node: "lou1", body });
  assert.equal(verify(SECRET, { method: "POST", path: "/v1/run", headers: h, body, node: "lou1", nonces }).ok, true);
  assert.equal(verify(SECRET, { method: "POST", path: "/v1/run", headers: h, body, node: "lou1", nonces }).reason, "这个请求已经用过了");
});
await test("参数检查", () => {
  assert.equal(validate({ lang: "cobol", mode: "acm", code: "x", cases: [{ stdin: "" }] }), "不支持的语言");
  assert.equal(validate({ lang: "rust", mode: "acm", code: "x", cases: [{ stdin: "" }] }), null);
  assert.equal(validate({ lang: "python", mode: "acm", code: "x", cases: [{ stdin: "" }], debug: true }), "这门语言不能在云端调试");
  assert.equal(validate({ lang: "kotlin", mode: "acm", code: "x", cases: [{ stdin: "" }], debug: true }), "这门语言不能在云端调试");
  assert.equal(validate({ lang: "java", mode: "leetcode", code: "x", cases: [{ input: [] }, { input: [] }], debug: true }), "调试一次只跑一组用例");
  assert.equal(validate({ lang: "java", mode: "leetcode", code: "x", cases: [{ input: [] }] }), "力扣模式要有函数签名");
  assert.equal(validate({ lang: "go", mode: "acm", code: "x", cases: [{ stdin: "1" }] }), null);
});

console.log("\n服务");
const IMAGE = process.env.RUNNER_TEST_IMAGE || "";
const driver = IMAGE ? new DockerPool({ image: IMAGE, size: 1 }) : new LocalDriver();
await driver.init();
const server = createServer({ node: "lou1", secret: SECRET, perMinute: 3, slots: 1, queue: 1, caseMs: 3000, totalMs: 20000, jobMs: 120000, version: "test" }, driver);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (path, { method = "POST", body = "", user = "alice", node = "lou1", headers } = {}) => {
  const res = await fetch(base + path, { method, headers: headers || { "content-type": "application/json", ...signedHeaders(SECRET, { method, path, node, user, body }) }, body: method === "GET" ? undefined : body });
  return { status: res.status, json: await res.json() };
};
const job = (code = "a, b = map(int, input().split())\nprint(a + b)\n") => JSON.stringify({ lang: "python", mode: "acm", code, cases: [{ stdin: "1 2" }] });

await test("没签名的、签给别的节点的请求被拒绝，健康检查不用签名", async () => {
  assert.equal((await call("/v1/run", { headers: { "content-type": "application/json" }, body: job() })).status, 401);
  assert.equal((await call("/v1/run", { body: job(), node: "lou2" })).status, 401);
  const h = await fetch(base + "/healthz");
  assert.equal(h.status, 200);
});
await test("状态里有节点编号和容量", async () => {
  const r = await call("/v1/status", { method: "GET" });
  assert.equal(r.status, 200);
  assert.equal(r.json.node, "lou1");
  assert.equal(r.json.slots, 1);
  assert.deepEqual(r.json.debugLangs, ["java", "cpp", "go"]);
});
await test("跑一次", async () => {
  const r = await call("/v1/run", { body: job() });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.node, "lou1");
  assert.equal(r.json.results[0].stdout.trim(), "3");
});
await test("同一个用户一分钟内跑太多次被限流", async () => {
  await call("/v1/run", { body: job(), user: "bob" });
  await call("/v1/run", { body: job(), user: "bob" });
  await call("/v1/run", { body: job(), user: "bob" });
  const r = await call("/v1/run", { body: job(), user: "bob" });
  assert.equal(r.status, 429, JSON.stringify(r.json));
});
await test("参数不对返回 400", async () => {
  const r = await call("/v1/run", { body: JSON.stringify({ lang: "rust", mode: "acm", code: "x", cases: [{ stdin: "" }] }), user: "carol" });
  assert.equal(r.status, 400);
});

server.close();
await driver.close();
console.log(`\n${failed ? "✗" : "✓"} ${passed} 项通过${failed ? `，${failed} 项失败` : ""}`);
process.exit(failed ? 1 : 0);
