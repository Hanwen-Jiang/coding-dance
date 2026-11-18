// FirecrackerDriver 的协议测试：对着假的 fc-manager（接口和 agent-runtime 的一样）跑，不要 KVM。
// 真 microVM 的测试在 CI 的「Firecracker」任务里：RUNNER_TEST_FC_URL 指到真的 fc-manager，sandbox.test.mjs 整套在 microVM 里跑。
import assert from "node:assert/strict";
import { FirecrackerDriver } from "../lib/sandbox.mjs";
import { createServer } from "../server.mjs";
import { signedHeaders } from "../lib/sign.mjs";
import { startFakeFcManager } from "./fake-fc-manager.mjs";

let failed = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓ " + name); } catch (e) { failed++; console.log("  ✗ " + name + "\n      " + String(e.stack || e).split("\n").slice(0, 5).join("\n      ")); }
}

const token = "t".repeat(40);
const fake = await startFakeFcManager({ token, maxVms: 1 });
const job = JSON.stringify({ lang: "python", mode: "acm", code: "print(sum(map(int, input().split())))\n", cases: [{ stdin: "20 22" }] });

await test("建一台 microVM、在里面跑沙箱、用完销毁", async () => {
  const d = new FirecrackerDriver({ url: fake.url, token });
  await d.init();
  const r = await d.run(job, 60000);
  assert.ok(r.ok, r.error);
  assert.equal(r.json.results[0].stdout.trim(), "42");
  await new Promise((ok) => setTimeout(ok, 200));
  assert.equal(fake.envs.size, 0, "用完要销毁");
  assert.deepEqual(fake.log.slice(-3).map((l) => l.replace(/env-\w+/, "<id>")), ["POST /v1/envs", "POST /v1/envs/<id>/agent/v1/exec", "DELETE /v1/envs/<id>"]);
});
await test("令牌从 fc-manager 的 SecretStore 文件里读", async () => {
  const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
  const f = path.join(os.tmpdir(), "fc-secrets-test.json");
  fs.writeFileSync(f, JSON.stringify({ version: 1, scopes: { _platform: { secrets: { "sandbox/fc-manager-token": token }, roles: [] } } }));
  const r = await new FirecrackerDriver({ url: fake.url, tokenFile: f }).run(job, 60000);
  fs.rmSync(f);
  assert.ok(r.ok, r.error);
});
await test("令牌不对：报错，不崩", async () => {
  const r = await new FirecrackerDriver({ url: fake.url, token: "x".repeat(40) }).run(job, 60000);
  assert.equal(r.ok, false);
  assert.match(r.error, /401/);
});
await test("microVM 满了：busy，服务返回 503（网站换节点）", async () => {
  const d = new FirecrackerDriver({ url: fake.url, token });
  const slow = JSON.stringify({ lang: "python", mode: "acm", code: "import time\ntime.sleep(1.5)\nprint(1)\n", cases: [{ stdin: "" }] });
  const first = d.run(slow, 60000);
  await new Promise((ok) => setTimeout(ok, 300));
  const r = await d.run(job, 60000);
  assert.equal(r.ok, false);
  assert.equal(r.busy, true);
  assert.ok((await first).ok);

  const secret = "s".repeat(40);
  const server = createServer({ node: "lou1", secret, perMinute: 50, slots: 4, queue: 4, caseMs: 3000, totalMs: 20000, jobMs: 60000, version: "test" }, d);
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (user) => fetch(base + "/v1/run", { method: "POST", headers: { "content-type": "application/json", ...signedHeaders(secret, { method: "POST", path: "/v1/run", node: "lou1", user, body: slow }) }, body: slow });
  const a = post("alice");
  await new Promise((ok) => setTimeout(ok, 300));
  const b = await post("bob");
  assert.equal(b.status, 503, await b.text());
  assert.equal((await a).status, 200);
  server.close();
});
await test("超过总时间：报错，VM 照样销毁", async () => {
  const d = new FirecrackerDriver({ url: fake.url, token });
  const loop = JSON.stringify({ lang: "python", mode: "acm", code: "while True:\n    pass\n", cases: [{ stdin: "" }], limits: { caseMs: 10000, totalMs: 20000 } });
  const r = await d.run(loop, 1500);
  assert.equal(r.ok, false);
  assert.match(r.error, /总时间/);
  await new Promise((ok) => setTimeout(ok, 200));
  assert.equal(fake.envs.size, 0);
});

fake.server.close();
console.log(`\n${failed ? "✗" : "✓"} ${passed} 项通过${failed ? `，${failed} 项失败` : ""}`);
process.exit(failed ? 1 : 0);
