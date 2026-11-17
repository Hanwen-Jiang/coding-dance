// node lib/practice/test/record.test.ts：练习区写进度仓（草稿、「测试全部」的记录、题解、状态），用假的 GitHub 跑一遍服务端
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { draftPath, findDraft, gitBlobSha, planSave, renderPracticeAttempt, solutionPath, validateSave } from "../record.ts";
import { loadPracticeDraft, savePractice } from "../server.ts";
import { matchExisting, parseAttemptPath, readAttempt, validateAttempt } from "../../sync/core.ts";
import { SyncError } from "../../sync/server.ts";
import { mockGitHub } from "../../sync/test/mock-github.ts";

let n = 0;
const test = async (name: string, fn: () => unknown) => { await fn(); n++; console.log(`ok ${n} - ${name}`); };
const throws = (fn: () => unknown, re: RegExp) => assert.throws(fn, (e: unknown) => e instanceof SyncError && re.test(e.message));
const rejects = (p: Promise<unknown>, re: RegExp) => assert.rejects(p, (e: unknown) => e instanceof SyncError && re.test(e.message));

const hot = { version: 1, problems: [{ id: 1, name: "两数之和", slug: "two-sum" }, { id: 146, name: "LRU 缓存", slug: "lru-cache" }] };
const P1 = hot.problems[0];
const CODE = "class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, x in enumerate(nums):\n            if target - x in seen:\n                return [seen[target - x], i]\n            seen[x] = i\r\n\r\n";
/** 2026-11-17 23:30 北京时间（UTC 15:30）：日期按北京时间算 */
const NOW = Date.parse("2026-11-17T15:30:00Z");
const run = (over: Record<string, unknown> = {}) => ({ kind: "run", id: 1, lang: "python", mode: "leetcode", code: CODE, result: "通过", passed: 40, total: 40, duration: 123.4, notes: [], ...over });

await test("检查页面传来的内容", () => {
  throws(() => validateSave(null), /kind/);
  throws(() => validateSave({ kind: "draft", id: 1, lang: "java", mode: "leetcode", code: "x" }), /lang/);
  throws(() => validateSave({ kind: "draft", id: 1, lang: "python", mode: "x", code: "x" }), /mode/);
  throws(() => validateSave({ kind: "draft", id: 1, lang: "python", mode: "acm", code: "   " }), /code/);
  throws(() => validateSave({ kind: "draft", id: 1, lang: "python", mode: "acm", code: "x".repeat(100_001) }), /太长/);
  throws(() => validateSave(run({ result: "思路不成立" })), /result/);
  throws(() => validateSave(run({ passed: 39 })), /全部通过/);
  throws(() => validateSave(run({ result: "答案错误" })), /全部通过/);
  throws(() => validateSave(run({ passed: 41 })), /passed/);
  const s = validateSave(run({ result: "答案错误", passed: 3, notes: ["## 代码\n```\n第二行", 5, "x".repeat(900), "", "a", "b", "c"] }));
  assert.equal(s.kind, "run");
  if (s.kind !== "run") return;
  assert.equal(s.duration, 123);
  // 说明只留字符串，每条一行、去掉开头的 #，最长 400 字，最多 5 条
  assert.deepEqual(s.notes.map((x) => x.length <= 400 && !x.includes("\n") && !x.startsWith("#")), [true, true, true, true]);
  assert.equal(s.notes[0], "代码 ``` 第二行");
});

await test("路径：草稿、题解、尝试记录；ACM 模式写法名是 ACM", () => {
  assert.equal(draftPath(P1, "python", "leetcode"), "drafts/python/0001.两数之和.py");
  assert.equal(draftPath(P1, "typescript", "acm"), "drafts/typescript/0001.两数之和.ACM.ts");
  assert.equal(solutionPath(hot.problems[1], "javascript", "leetcode"), "solutions/javascript/0146.LRU 缓存.js");
  const paths = ["drafts/python/0001.两数之和.ACM.py", "drafts/python/0001.两数之和.py", "drafts/python/0010.正则.py"];
  assert.equal(findDraft(paths, 1, "python", "leetcode"), "drafts/python/0001.两数之和.py");
  assert.equal(findDraft(paths, 1, "python", "acm"), "drafts/python/0001.两数之和.ACM.py");
  assert.equal(findDraft(paths, 1, "javascript", "leetcode"), null);
  assert.equal(findDraft(paths, 1, "../x", "leetcode"), null);
});

await test("尝试记录的格式符合进度仓的规则，同步不拿它去和力扣提交对", () => {
  const s = validateSave(run({ result: "答案错误", passed: 3, notes: ["用例 4：预期 [0,1]，实际 [1,0]"] }));
  if (s.kind !== "run") throw new Error();
  const text = renderPracticeAttempt(s, { date: "2026-11-17", time: "23:30:00" });
  assert.deepEqual(validateAttempt(text), []);
  const a = readAttempt(text);
  assert.equal(a.source, "practice");
  assert.equal(a.code, CODE.replace(/\r\n/g, "\n").replace(/\s+$/, ""));
  assert.match(text, /^ranAt: 2026-11-17T23:30:00\+08:00$/m);
  assert.match(text, /^- 用例 4：预期 \[0,1\]，实际 \[1,0\]$/m);
  // 代码里有三个反引号也不会弄坏代码块
  const tricky = validateSave(run({ code: "x = '```'\n" }));
  if (tricky.kind !== "run") throw new Error();
  assert.deepEqual(validateAttempt(renderPracticeAttempt(tricky, { date: "2026-11-17", time: "00:00:00" })), []);
  // matchExisting 本身按代码对，所以练习区的记录要在 plan.ts 里先排除（见 plan.ts 的 source !== "practice"）
  assert.equal(typeof matchExisting, "function");
});

await test("planSave：当天序号接着排、全部通过才存题解、状态只升不降", () => {
  const paths = ["attempts/0001.两数之和/2026-11-17.1.答案错误.md", "attempts/0001.两数之和/2026-11-17.2.通过.md", "attempts/0001.两数之和/2026-11-16.5.通过.md", "attempts/0146.LRU 缓存/2026-11-17.7.超时.md"];
  const ok = planSave(validateSave(run()), { problem: P1, paths, progress: null, now: NOW });
  assert.equal(ok.attempt, "attempts/0001.两数之和/2026-11-17.3.通过.md");
  assert.equal(ok.solution, "solutions/python/0001.两数之和.py");
  assert.equal(ok.status, "已通过");
  assert.deepEqual(ok.files.map((f) => f.path), [ok.attempt, ok.solution, "progress.json"]);
  assert.equal(ok.files[1].content, CODE.replace(/\r\n/g, "\n").replace(/\s+$/, "") + "\n");
  assert.deepEqual(JSON.parse(ok.files[2].content), { version: 1, problems: { 1: { status: "已通过", updatedAt: "2026-11-17" } } });

  const wa = planSave(validateSave(run({ result: "答案错误", passed: 1 })), { problem: P1, paths: [], progress: { version: 1, problems: { 1: { status: "已通过", updatedAt: "2026-11-01" } } }, now: NOW });
  assert.equal(wa.attempt, "attempts/0001.两数之和/2026-11-17.1.答案错误.md");
  assert.equal(wa.solution, undefined);
  assert.equal(wa.status, undefined, "已通过的题再错一次，状态不降");
  assert.deepEqual(wa.files.map((f) => f.path), [wa.attempt]);

  const first = planSave(validateSave(run({ result: "超时", passed: 0 })), { problem: P1, paths: [], progress: null, now: NOW });
  assert.equal(first.status, "尝试过");
  assert.ok(parseAttemptPath(first.attempt!));

  const acm = planSave(validateSave(run({ mode: "acm", lang: "typescript" })), { problem: P1, paths: [], progress: null, now: NOW });
  assert.equal(acm.solution, "solutions/typescript/0001.两数之和.ACM.ts");
});

await test("git 的 blob sha 和 git 算的一样", async () => {
  const c = "print('你好')\n";
  const want = createHash("sha1").update(`blob ${Buffer.byteLength(c)}\0`).update(c).digest("hex");
  assert.equal(await gitBlobSha(c), want);
});

await test("服务端：存草稿，没改就不再提交，读得回来", async () => {
  const gh = mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": JSON.stringify({ version: 1, problems: {} }) });
  const draft = { kind: "draft", id: 1, lang: "python", mode: "leetcode", code: CODE };
  const r1 = await savePractice(gh.api, gh.repo, draft, () => NOW);
  assert.equal(r1.saved, true);
  assert.equal(r1.draft, "drafts/python/0001.两数之和.py");
  assert.equal(gh.files()["drafts/python/0001.两数之和.py"], CODE.replace(/\r\n/g, "\n").replace(/\s+$/, "") + "\n");
  const commits = gh.log().length;
  const r2 = await savePractice(gh.api, gh.repo, { ...draft, code: CODE + "\n\n" }, () => NOW);
  assert.equal(r2.saved, false, "内容一样（只差末尾空白）不产生新的 commit");
  assert.equal(gh.log().length, commits);
  assert.match(gh.log()[0], /^练习草稿：第 1 题 两数之和 · Python$/);
  const back = await loadPracticeDraft(gh.api, gh.repo, new URLSearchParams("id=1&lang=python&mode=leetcode"));
  assert.equal(back.code, gh.files()["drafts/python/0001.两数之和.py"]);
  assert.deepEqual(await loadPracticeDraft(gh.api, gh.repo, new URLSearchParams("id=1&lang=python&mode=acm")), { code: null });
  await rejects(loadPracticeDraft(gh.api, gh.repo, new URLSearchParams("id=x&lang=python&mode=acm")), /参数/);
});

await test("服务端：「测试全部」记成一个 commit（记录 + 题解 + 状态），分支被别处移动过就重读再写", async () => {
  const gh = mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": JSON.stringify({ version: 1, problems: { 146: { status: "尝试过" } } }) });
  // 第一次读完之后、写之前，别处往仓库推了一个 commit：PATCH refs 返回 422，服务端重读一遍再写
  let pushed = false;
  const api: typeof gh.api = async (method, path, body) => {
    if (method === "POST" && path.endsWith("/git/trees") && !pushed) { pushed = true; gh.push("attempts/0001.两数之和/2026-11-17.1.答案错误.md", "---\nlang: java\n---\n"); }
    return gh.api(method, path, body);
  };
  const res = await savePractice(api, gh.repo, run(), () => NOW);
  assert.equal(res.saved, true);
  assert.equal(res.attempt, "attempts/0001.两数之和/2026-11-17.2.通过.md", "重读之后序号接着别处刚写的那条");
  assert.deepEqual(res.files, [res.attempt, "solutions/python/0001.两数之和.py", "progress.json"]);
  const files = gh.files();
  assert.deepEqual(validateAttempt(files[res.attempt!]), []);
  assert.deepEqual(JSON.parse(files["progress.json"]).problems, { 1: { status: "已通过", updatedAt: "2026-11-17" }, 146: { status: "尝试过" } });
  assert.match(gh.log()[0], /^练习：第 1 题 两数之和 · Python · 通过（40\/40）$/);
  // 同一份代码再全部通过一次：记录照记（第 3 次），题解和状态没变就不写
  const again = await savePractice(gh.api, gh.repo, run(), () => NOW);
  assert.deepEqual(again.files, ["attempts/0001.两数之和/2026-11-17.3.通过.md"]);
});

await test("服务端：拒绝不合规的请求和不在热题里的题", async () => {
  const gh = mockGitHub({ "hot100.json": JSON.stringify(hot) });
  await rejects(savePractice(gh.api, gh.repo, { kind: "run", id: 1, lang: "python", mode: "leetcode", code: "x", result: "通过", passed: 1, total: 2 }), /全部通过/);
  await rejects(savePractice(gh.api, gh.repo, { kind: "draft", id: 2, lang: "python", mode: "leetcode", code: "x" }), /不在/);
  const empty = mockGitHub({ "progress.json": "{}" });
  await rejects(savePractice(empty.api, empty.repo, { kind: "draft", id: 1, lang: "python", mode: "leetcode", code: "x" }), /hot100\.json/);
  assert.equal(gh.log().length, 1, "一个都没写");
});

console.log(`\n${n} 项全部通过`);
