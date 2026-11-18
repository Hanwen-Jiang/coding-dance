// 网站调用远端运行器的签名：和 tools/runner/lib/sign.mjs 的算法一致；再起一个本机的运行器，用网站这边的代码真调一次。
// 运行：node functions/_lib/test/runner.test.ts（在 site/ 里）
import assert from "node:assert/strict";
import { callRunner, sha256, sign } from "../runner.ts";

// tools/runner/test/server.test.mjs 用同一组输入算出的签名
const fixed = await sign("k".repeat(32), { method: "post", path: "/v1/run", time: 1700000000, nonce: "abcdefabcdefabcdef", user: "octocat", bodyHash: await sha256('{"a":1}') });
assert.equal(fixed, "22d0c4f716965fb7ebcaf2d048d063d086dff9a712d0c4f6c2f8d9438824bba6");
console.log("✓ 签名和运行器那边一致");

const { createServer } = await import("../../../../tools/runner/server.mjs");
const { LocalDriver } = await import("../../../../tools/runner/lib/sandbox.mjs");
const secret = "s".repeat(40);
const server = createServer({ secret, perMinute: 10, slots: 1, queue: 1, caseMs: 3000, totalMs: 20000, jobMs: 60000, version: "test" }, new LocalDriver());
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const env = { RUNNER_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}/`, RUNNER_SECRET: secret };
try {
  const status = await callRunner(env, "GET", "/v1/status", "");
  assert.equal(status.status, 200);
  const body = JSON.stringify({ lang: "python", mode: "acm", code: "print(sum(map(int, input().split())))\n", cases: [{ stdin: "20 22" }] });
  const res = await callRunner(env, "POST", "/v1/run", "octocat", body);
  const data = (await res.json()) as { results: { stdout: string }[] };
  assert.equal(res.status, 200, JSON.stringify(data));
  assert.equal(data.results[0].stdout.trim(), "42");
  const bad = await callRunner({ ...env, RUNNER_SECRET: "x".repeat(40) }, "GET", "/v1/status", "");
  assert.equal(bad.status, 401);
  console.log("✓ 网站这边签名的请求，运行器认；密钥不对的不认");
} finally {
  server.close();
}
