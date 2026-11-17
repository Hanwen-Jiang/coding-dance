// node lib/practice/test/record.test.ts：练习里「测试全部」记进进度仓（假的 GitHub）
import assert from "node:assert/strict";
import { beijing, recordRun, renderSiteAttempt, validateRecordInput, type RecordInput } from "../record.ts";
import { buildPlan, ConflictError, type RepoClient } from "../../sync/plan.ts";
import { createLeetCode } from "../../sync/leetcode.ts";
import { commitWrites, readBlobs, readRepo, SyncError, validateWrites } from "../../sync/server.ts";
import { frontMatter, parseSolutionPath, readAttempt, validateAttempt } from "../../sync/core.ts";
import { mockGitHub } from "../../sync/test/mock-github.ts";

const hot = { version: 1, problems: [
  { id: 1, name: "两数之和", slug: "two-sum" },
  { id: 3, name: "无重复字符的最长子串", slug: "longest-substring-without-repeating-characters" },
] };
const repoWith = (extra: Record<string, string> = {}, progress: object = {}) =>
  mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": JSON.stringify({ version: 1, problems: progress }, null, 2) + "\n", ...extra });

const AC = "class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, x in enumerate(nums):\n            if target - x in seen:\n                return [seen[target - x], i]\n            seen[x] = i\n";
const WA = "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]\n";
const input = (over: Partial<RecordInput> = {}): RecordInput => validateRecordInput({
  id: 1, language: "python", mode: "leetcode", code: AC, result: "通过", passed: 12, total: 12, durationMs: 41.6, failures: [], ...over,
});
// 2026-11-17 01:30 北京时间 = 2026-11-16 17:30 UTC：日期按北京时间算
const NOW = new Date("2026-11-16T17:30:05Z");

// 1) 输入检查：网页传来的东西不对就整个拒绝
assert.deepEqual(beijing(NOW), { date: "2026-11-17", stamp: "2026-11-17T01:30:05+08:00" });
for (const bad of [
  { id: 0 }, { id: 1.5 }, { language: "java" }, { mode: "oj" }, { code: "   " }, { code: "x".repeat(100_001) },
  { result: "思路不成立" }, { result: "通过", passed: 3, total: 12 }, { result: "答案错误", passed: 12, total: 12 },
  { passed: 13, total: 12 }, { total: 0, passed: 0 }, { durationMs: -1 }, { durationMs: Number.NaN },
]) assert.throws(() => input(bad as Partial<RecordInput>), SyncError, JSON.stringify(bad));
const long = input({ result: "答案错误", passed: 0, code: WA, failures: [1, 2, 3, 4].map((i) => ({ label: `用例 ${i}`, input: "x".repeat(1000), expected: "[0,1]", actual: "[1,2]" })) });
assert.equal(long.failures.length, 3, "最多记 3 组没通过的用例");
assert.equal(long.failures[0].input.length, 301, "每项截到 300 字");

// 2) 记录的格式：符合进度仓的规则，同步和网站都读得懂
const text = renderSiteAttempt(input({ code: "x = '```'\r\nprint(x)  \r\n\r\n" }), "2026-11-17T01:30:05+08:00");
assert.deepEqual(validateAttempt(text), []);
assert.deepEqual(frontMatter(text), { lang: "python", verbatim: "true", source: "hot100-site", submittedAt: "2026-11-17T01:30:05+08:00" });
assert.equal(readAttempt(text).code, "x = '```'\nprint(x)", "代码原样保存（只统一换行、去掉末尾空白），反引号不会弄坏代码块");
assert.match(text, /## 网站测试结果\n\n通过 · 用例 12 \/ 12 · 用时 42 ms · LeetCode 模式\n/);
assert.doesNotMatch(text, /没通过的用例/);
const failText = renderSiteAttempt(input({ result: "运行出错", passed: 1, code: WA, mode: "acm", failures: [{ label: "示例 2", input: "3 2\n1 2 3", expected: "0 1", actual: "", error: "IndexError: list index out of range（第 3 行：return [0, 1]）" }] }), "2026-11-17T01:30:05+08:00");
assert.deepEqual(validateAttempt(failText), []);
assert.match(failText, /运行出错 · 用例 1 \/ 12 · 用时 42 ms · ACM 模式/);
assert.match(failText, /## 没通过的用例\n\n示例 2\n输入：3 2\n1 2 3\n期望：0 1\n出错：IndexError/);

// 3) 第一次通过：一条尝试记录 + 一份题解 + 状态改成已通过，一个 commit
{
  const gh = repoWith();
  const r = await recordRun({ api: gh.api, repo: gh.repo, input: input(), now: NOW });
  assert.equal(r.attempt, "attempts/0001.两数之和/2026-11-17.1.通过.md");
  assert.equal(r.solution, "solutions/python/0001.两数之和.py");
  assert.equal(r.status, "已通过");
  assert.match(r.url, /^https:\/\/github\.com\/me\/hot100-progress\/commit\//);
  const files = gh.files();
  assert.equal(files["solutions/python/0001.两数之和.py"], AC);
  assert.deepEqual(JSON.parse(files["progress.json"]).problems, { 1: { status: "已通过", updatedAt: "2026-11-17" } });
  assert.equal(gh.log().length, 2, "只多一个 commit");
  assert.match(gh.log()[0], /^练习：第 1 题「两数之和」通过（python，用例 12 \/ 12）/);

  // 同一份代码再测一次：只加尝试记录（序号 +1），题解和状态都不动
  const again = await recordRun({ api: gh.api, repo: gh.repo, input: input({ code: "# 哈希表：边走边查\n" + AC.replace("seen = {}", "seen={}").replace(/\n/g, "\r\n") }), now: NOW });
  assert.equal(again.attempt, "attempts/0001.两数之和/2026-11-17.2.通过.md");
  assert.equal(again.solution, null, "和已有题解只差注释和空白：不另存");
  assert.equal(again.status, null);

  // 换一种写法通过：另存成 .2，已有的题解一个字不动
  const other = "class Solution:\n    def twoSum(self, nums, target):\n        for i in range(len(nums)):\n            for j in range(i + 1, len(nums)):\n                if nums[i] + nums[j] == target:\n                    return [i, j]\n";
  const third = await recordRun({ api: gh.api, repo: gh.repo, input: input({ code: other }), now: NOW });
  assert.equal(third.solution, "solutions/python/0001.两数之和.2.py");
  assert.equal(gh.files()["solutions/python/0001.两数之和.py"], AC);

  // 答案错误：只记尝试，不存题解；已通过的状态不降
  const wrong = await recordRun({ api: gh.api, repo: gh.repo, input: input({ code: WA, result: "答案错误", passed: 3 }), now: NOW });
  assert.equal(wrong.attempt, "attempts/0001.两数之和/2026-11-17.4.答案错误.md");
  assert.equal(wrong.solution, null);
  assert.equal(wrong.status, null);
  assert.equal(Object.keys(gh.files()).filter((p) => p.startsWith("solutions/")).length, 2);
}

// 4) 没通过的第一次：状态从未开始变成尝试过；「曾通过」的题没通过不改
{
  const gh = repoWith({}, { 3: { status: "曾通过", updatedAt: "2026-11-01" } });
  const r = await recordRun({ api: gh.api, repo: gh.repo, input: input({ code: WA, result: "超时", passed: 0 }), now: NOW });
  assert.equal(r.status, "尝试过");
  const r3 = await recordRun({ api: gh.api, repo: gh.repo, input: input({ id: 3, code: WA, result: "答案错误", passed: 1 }), now: NOW });
  assert.equal(r3.status, null);
  assert.equal(r3.attempt, "attempts/0003.无重复字符的最长子串/2026-11-17.1.答案错误.md");
  // 曾通过的题后来又通过了：改成已通过
  const ok3 = await recordRun({ api: gh.api, repo: gh.repo, input: input({ id: 3 }), now: NOW });
  assert.equal(ok3.status, "已通过");
}

// 5) 已有别的写法的题解（手写的 .dp 写法），序号接着当天已有的记录排
{
  const gh = repoWith({
    "solutions/python/0001.两数之和.dp.py": WA,
    "solutions/javascript/0001.两数之和.js": "var twoSum = function () {};\n",
    "attempts/0001.两数之和/2026-11-17.3.答案错误.md": "---\nlang: python\n---\n\n## 想法\n\n先写了暴力。\n",
  });
  const r = await recordRun({ api: gh.api, repo: gh.repo, input: input(), now: NOW });
  assert.equal(r.attempt, "attempts/0001.两数之和/2026-11-17.4.通过.md");
  assert.equal(r.solution, "solutions/python/0001.两数之和.py", "主文件名空着就用它");
  // 同一份代码已经是某个写法的题解：不再存
  const r2 = await recordRun({ api: gh.api, repo: gh.repo, input: input({ code: WA.replace("[0, 1]", "[0,1]"), result: "通过" }), now: NOW });
  assert.equal(r2.solution, null);
  // JavaScript 的题解按 JavaScript 的目录算
  const js = await recordRun({ api: gh.api, repo: gh.repo, input: input({ language: "javascript", code: "var twoSum = function (nums, target) {\n  return [0, 1];\n};\n" }), now: NOW });
  assert.equal(js.solution, "solutions/javascript/0001.两数之和.2.js");
}

// 6) 写的时候仓库被别处改了（比如网站上刚改了状态）：重新读一遍再写，别人的改动保留
{
  const gh = repoWith();
  let pushed = false;
  const api: typeof gh.api = async (method, path, body) => {
    if (method === "PATCH" && !pushed) { pushed = true; gh.push("progress.json", JSON.stringify({ version: 1, problems: { 3: { status: "已通过", updatedAt: "2026-11-16" } } }, null, 2) + "\n", "网站上改状态"); }
    return gh.api(method, path, body);
  };
  const r = await recordRun({ api, repo: gh.repo, input: input(), now: NOW });
  assert.equal(r.status, "已通过");
  assert.deepEqual(Object.keys(JSON.parse(gh.files()["progress.json"]).problems), ["1", "3"]);
  assert.deepEqual(gh.log().slice(0, 2).map((m) => m.split("\n")[0]), ["练习：第 1 题「两数之和」通过（python，用例 12 / 12）", "网站上改状态"]);
}

// 7) 出错的情况
{
  const gh = repoWith();
  await assert.rejects(recordRun({ api: gh.api, repo: gh.repo, input: input({ id: 2 }), now: NOW }), /题单里没有第 2 题/);
  const bare = mockGitHub({ "README.md": "x" });
  await assert.rejects(recordRun({ api: bare.api, repo: bare.repo, input: input(), now: NOW }), /没有 hot100\.json/);
  const missing = mockGitHub({}, { owner: "someone-else" });
  await assert.rejects(recordRun({ api: missing.api, repo: "me/hot100-progress", input: input(), now: NOW }), /找不到你的进度仓/);
}

// 8) 写入检查：题解只有练习接口能写，从力扣同步不能写
const base = { branch: "main", parent: "a".repeat(40), baseTree: "b".repeat(40), message: "m" };
assert.throws(() => validateWrites({ ...base, files: [{ path: "solutions/python/0001.两数之和.py", content: AC }] }), /同步不能写/);
validateWrites({ ...base, files: [{ path: "solutions/python/0001.两数之和.py", content: AC }] }, { solutions: true });
for (const p of ["solutions/python/0001.两数之和.js", "solutions/python/1.两数之和.py", "solutions/../x.py", "solutions/python/0001.两数之和.a.b.py", "README.md", ".github/workflows/x.yml"]) {
  assert.throws(() => validateWrites({ ...base, files: [{ path: p, content: "x" }] }, { solutions: true }), SyncError, p);
}
assert.deepEqual(parseSolutionPath("solutions/cpp/0015.三数之和.双指针.cc"), { lang: "cpp", id: 15, name: "三数之和", variant: "双指针", ext: "cc" });

// 9) 从力扣同步时，网站练习记下的记录不拿去和力扣提交配对（代码一样也不补编号），力扣的提交照常导入
{
  const gh = repoWith({ "attempts/0001.两数之和/2026-11-17.1.通过.md": renderSiteAttempt(input(), "2026-11-17T01:30:05+08:00") });
  const sub = { id: 901, title: "两数之和", status: "AC", lang: "python3", statusDisplay: "Accepted", isPending: "Not Pending", timestamp: String(Math.floor(Date.parse("2026-11-17T09:00:00+08:00") / 1000)) };
  const transport = async (query: string, v: any): Promise<any> => {
    if (query.includes("submissionList")) return { submissionList: { lastKey: null, hasNext: false, submissions: v.offset ? [] : [sub] } };
    if (query.includes("submissionDetail")) return { submissionDetail: { id: v.id, lang: "python3", code: AC, passedTestCaseCnt: 63, totalTestCaseCnt: 63, runtime: "0 ms", memory: "17 MB" } };
    if (query.includes("userProgressQuestionList")) return { userProgressQuestionList: { totalNum: 0, questions: [] } };
    throw new Error("unexpected query");
  };
  const client: RepoClient = {
    head: () => readRepo(gh.api, gh.repo),
    texts: (shas) => readBlobs(gh.api, gh.repo, shas),
    commit: async (args) => { const r = await commitWrites(gh.api, gh.repo, args); if ("conflict" in r) throw new ConflictError("conflict"); return r; },
  };
  const plan = await buildPlan({ repo: client, lc: createLeetCode(transport, { gap: 0, backoff: 1 }), cache: new Map(), onProgress: () => {} });
  assert.deepEqual(plan.linked, [], "网站练习的记录不补力扣编号");
  assert.deepEqual(plan.added.map((f) => f.path), ["attempts/0001.两数之和/2026-11-17.2.通过.md"]);
}

console.log("record tests passed");
