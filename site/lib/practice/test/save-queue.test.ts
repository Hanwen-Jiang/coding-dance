// node lib/practice/test/save-queue.test.ts：练习区存进度仓的队列（浏览器端），用假的 fetch 跑
import assert from "node:assert/strict";

type Call = { body: Record<string, unknown>; keepalive: boolean };
const calls: Call[] = [];
let respond: (body: Record<string, unknown>) => Promise<{ status: number; json: unknown }> = async () => ({ status: 200, json: { saved: true } });
globalThis.fetch = (async (_url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body));
  calls.push({ body, keepalive: !!init.keepalive });
  const r = await respond(body);
  return new Response(JSON.stringify(r.json), { status: r.status, headers: { "Content-Type": "application/json" } });
}) as typeof fetch;
// 重试要等几秒：测试里把定时器缩短成立刻
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: () => void, _ms?: number) => realTimeout(fn, 1)) as typeof setTimeout;

const { practiceSaves } = await import("../save-queue.ts");
const q = practiceSaves();
let n = 0;
const test = async (name: string, fn: () => unknown) => { calls.length = 0; await fn(); n++; console.log(`ok ${n} - ${name}`); };

await test("一次只发一个；同一份草稿还在排队时又存了一次，只发最新的", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  respond = async (b) => { if (b.code === "a") await gate; return { status: 200, json: { saved: true, draft: "d" } }; };
  const p1 = q.push("draft:1", { kind: "draft", code: "a" }, true);
  const p2 = q.push("draft:1", { kind: "draft", code: "b" }, true);
  const p3 = q.push("draft:1", { kind: "draft", code: "c" }, true);
  const r1 = q.push("run:1", { kind: "run", code: "a" }, false);
  assert.equal(calls.length, 1, "第一个还没回来，后面的都在排队");
  release();
  const [a, b, c, r] = await Promise.all([p1, p2, p3, r1]);
  assert.deepEqual(calls.map((x) => x.body.code), ["a", "c", "a"], "b 被 c 合并掉了；记录不合并");
  assert.equal(a?.saved, true);
  assert.ok(b && b === c && b !== a, "合并进来的那几次拿到同一个结果（最新那份的）");
  assert.equal(r?.saved, true);
  assert.equal(q.state("draft:1")?.phase, "saved");
});

await test("网络出错、5xx、409 重试；没登录这类不重试", async () => {
  let fails = 2;
  respond = async () => (fails-- > 0 ? { status: 502, json: { error: "GitHub 返回 502" } } : { status: 200, json: { saved: true } });
  assert.equal((await q.push("draft:2", { kind: "draft", code: "x" }, true))?.saved, true);
  assert.equal(calls.length, 3);
  respond = async () => ({ status: 401, json: { error: "还没登录" } });
  assert.equal(await q.push("draft:3", { kind: "draft", code: "x" }, true), null);
  assert.equal(calls.length, 4, "401 不重试");
  const s = q.state("draft:3");
  assert.ok(s?.phase === "error" && s.error === "还没登录" && !s.retrying);
  respond = async () => ({ status: 409, json: { error: "进度仓刚被别的地方改过" } });
  assert.equal(await q.push("draft:4", { kind: "draft", code: "x" }, true), null);
  assert.equal(calls.length, 4 + 4, "409 重试 3 次后放弃");
});

await test("页面切到后台：排队的全部立刻发出去（keepalive）", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  respond = async (b) => { if (b.code === "slow") await gate; return { status: 200, json: { saved: true } }; };
  const slow = q.push("run:5", { kind: "run", code: "slow" }, false);
  const d = q.push("draft:5", { kind: "draft", code: "y" }, true);
  assert.equal(calls.length, 1);
  q.flush();
  assert.equal(calls.length, 2, "排队的草稿不等前面那个，立刻发");
  assert.ok(calls.every((c) => c.keepalive), "小请求都带 keepalive");
  assert.equal((await d)?.saved, true);
  release();
  assert.equal((await slow)?.saved, true);
  assert.equal(calls.length, 2, "正在发的那个不重复发");
});

globalThis.setTimeout = realTimeout;
console.log(`\n${n} 项全部通过`);
