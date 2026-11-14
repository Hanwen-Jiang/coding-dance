// node test/sync.test.mjs：用假的力扣数据和假的 GitHub 跑一遍同步流程
import assert from "node:assert/strict";
import { buildPlan, commitPlan } from "../sync.js";
import { createGitHub } from "../github.js";
import { createLeetCode } from "../leetcode.js";
import { cnParts, fence, frontMatter, nextStatus, parseAttemptPath } from "../core.js";
import { mockGitHub } from "./mock-github.mjs";

const T = (s) => String(Math.floor(Date.parse(s) / 1000)); // 北京时间写法的时刻 → 秒
const hot = { version: 1, problems: [
  { id: 1, name: "两数之和", slug: "two-sum" },
  { id: 2, name: "两数相加", slug: "add-two-numbers" },
  { id: 3, name: "无重复字符的最长子串", slug: "longest-substring-without-repeating-characters" },
  { id: 4, name: "寻找两个正序数组的中位数", slug: "median-of-two-sorted-arrays" },
  { id: 5, name: "最长回文子串", slug: "longest-palindromic-substring" },
] };
// 力扣上的提交（最新的在前，和真接口一样）
const LC = {
  "two-sum": [
    { id: 103, status: "AC", lang: "mysql", langVerboseName: "MySQL", timestamp: T("2026-11-10T10:09:00+08:00") },
    { id: 102, status: "AC", lang: "python3", runtime: "4 ms", memory: "17 MB", timestamp: T("2026-11-10T10:05:00+08:00") },
    { id: 101, status: "WA", lang: "python3", runtime: "N/A", memory: "N/A", timestamp: T("2026-11-10T10:00:00+08:00") },
  ],
  "add-two-numbers": [{ id: 201, status: "RE", lang: "java", timestamp: T("2026-11-11T23:59:59+08:00") }],
  "longest-substring-without-repeating-characters": [{ id: 301, status: "AC", lang: "cpp", timestamp: T("2026-11-12T00:00:01+08:00") }],
  "median-of-two-sorted-arrays": [{ id: 401, status: "AC", lang: "golang", timestamp: T("2026-11-12T08:00:00+08:00") }],
  "longest-palindromic-substring": [{ id: 501, status: "TLE", lang: "java", timestamp: T("2026-11-13T08:00:00+08:00") }],
};
const CODE = { 101: "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 0]", 102: "class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        # ```三个反引号也不会弄坏代码块```\n        ..." };
const transport = async (query, v) => {
  if (query.includes("userProgressQuestionList")) return { userProgressQuestionList: { totalNum: 5, questions: Object.keys(LC).map((s) => ({ titleSlug: s, numSubmitted: LC[s].length })) } };
  if (query.includes("submissionList")) return { submissionList: { lastKey: null, hasNext: false, submissions: LC[v.questionSlug].map((s) => ({ ...s, isPending: "Not Pending", statusDisplay: s.status })) } };
  if (query.includes("submissionDetail")) {
    const s = Object.values(LC).flat().find((x) => String(x.id) === v.id);
    return { submissionDetail: { id: v.id, lang: s.lang, code: CODE[s.id] ?? `int x${s.id} = 0;`, passedTestCaseCnt: s.status === "AC" ? 63 : 12, totalTestCaseCnt: 63, runtime: s.runtime || "N/A", memory: s.memory || "N/A", runtimePercentile: 88.888, memoryPercentile: 0 } };
  }
  throw new Error("unexpected query");
};

const manual = "---\nlang: python\n---\n\n## 想法\n\n先自己想了一遍暴力。\n";
// 手写的记录：代码和力扣上 501 那次提交一样（行尾多了空格、用的 CRLF），应该对上，不再导入
const hand501 = "---\r\nlang: java\r\n---\r\n\r\n## 错在哪里\r\n\r\n死循环。\r\n\r\n## 代码\r\n\r\n```java\r\nint x501 = 0;   \r\n```\r\n";
// 代码整理过（verbatim: false）的记录：按「同一天、同一结果」和 401 对上
const hand401 = "---\nlang: go\nverbatim: false\n---\n\n## 说明\n\n整理过的写法。\n\n## 代码\n\n```go\nfunc f() {}\n```\n";
const gh0 = mockGitHub({
  "hot100.json": JSON.stringify(hot),
  "progress.json": JSON.stringify({ version: 1, problems: { 3: { status: "曾通过", updatedAt: "2026-11-01" }, 4: { status: "曾通过" }, 5: { status: "已通过", updatedAt: "2026-10-01" } } }, null, 2) + "\n",
  "attempts/0001.两数之和/2026-11-10.1.思路不成立.md": manual,
  "attempts/0005.最长回文子串/2026-11-13.1.超时.md": hand501,
  "attempts/0004.寻找两个正序数组的中位数/2026-11-12.1.通过.md": hand401,
});
const gh = createGitHub({ fetch: gh0.fetch, getToken: async () => "t" });
// 前两次请求被限流，之后正常
let limited = 2;
const waits = [];
const flaky = async (q, v) => { if (q.includes("submissionList") && limited-- > 0) throw new Error("力扣：🐸☕超出访问限制，请稍后再试"); return transport(q, v); };
const lc = createLeetCode(flaky, { gap: 0, backoff: 1, onWait: (s) => waits.push(s) });
const cache = new Map();

// 1) 第一次同步
const plan = await buildPlan({ gh, lc, repo: gh0.repo, shaCache: cache });
const paths = plan.added.map((f) => f.path);
assert.deepEqual(paths, [
  "attempts/0001.两数之和/2026-11-10.2.答案错误.md", // 当天已有一条手写的，序号接着排
  "attempts/0001.两数之和/2026-11-10.3.通过.md",
  "attempts/0002.两数相加/2026-11-11.1.运行出错.md", // 23:59:59 北京时间，日期不能算到第二天
  "attempts/0003.无重复字符的最长子串/2026-11-12.1.通过.md",
]);
assert.equal(waits.length, 2, "被限流两次，各等了一次");
// 两条手写记录对上了：只在设置里补三行，其余一个字不动
const link = Object.fromEntries(plan.linked.map((f) => [f.path, f]));
assert.deepEqual(Object.keys(link).sort(), ["attempts/0004.寻找两个正序数组的中位数/2026-11-12.1.通过.md", "attempts/0005.最长回文子串/2026-11-13.1.超时.md"]);
assert.equal(link["attempts/0005.最长回文子串/2026-11-13.1.超时.md"].content,
  "---\r\nlang: java\r\nsource: leetcode.cn\r\nsubmission: 501\r\nsubmittedAt: 2026-11-13T08:00:00+08:00\r\n---\r\n" + hand501.slice("---\r\nlang: java\r\n---\r\n".length));
assert.equal(frontMatter(link["attempts/0004.寻找两个正序数组的中位数/2026-11-12.1.通过.md"].content).submission, "401");
assert.equal(plan.skipped.length, 1);
assert.match(plan.skipped[0].reason, /MySQL/);
const st = Object.fromEntries([...plan.changes].map(([k, v]) => [k, v.status]));
assert.deepEqual(st, { 1: "已通过", 2: "尝试过", 3: "已通过" }); // 4 曾通过没有日期，不动；5 已通过不动
const f102 = plan.added[1].content;
assert.equal(frontMatter(f102).submission, "102");
assert.equal(frontMatter(f102).submittedAt, "2026-11-10T10:05:00+08:00");
assert.ok(f102.includes("````python\n"), "代码里有三个反引号时围栏要用四个");
assert.ok(f102.includes("通过 · 用例 63 / 63 · 执行用时 4 ms（击败 88.9%） · 内存 17 MB\n"));
assert.ok(plan.added[0].content.includes("解答错误 · 用例 12 / 63\n"));

// 2) 写入时网站刚好改了别的题的状态：重新读一遍，要导入的提交没变，照常写入，网站的改动保留
gh0.push("progress.json", JSON.stringify({ version: 1, problems: { 3: { status: "曾通过", updatedAt: "2026-11-01" }, 4: { status: "曾通过" }, 5: { status: "已通过", updatedAt: "2026-10-01" }, 99: { status: "已通过" } } }, null, 2) + "\n", "进度：第 99 题 → 已通过");
const res = await commitPlan({ gh, lc, plan, shaCache: cache });
assert.ok(res.sha && !res.changed);
const files = gh0.files();
const prog = JSON.parse(files["progress.json"]);
assert.equal(prog.problems[99].status, "已通过");
assert.equal(prog.problems[1].status, "已通过");
assert.equal(prog.problems[1].updatedAt, "2026-11-10");
assert.deepEqual(Object.keys(prog.problems), ["1", "2", "3", "4", "5", "99"]);
assert.equal(gh0.log().length, 3, "同步只产生一个 commit");
assert.match(gh0.log()[0], /^同步力扣提交记录：4 次提交（3 道题），给 2 条手写记录补上提交编号/);
for (const p of Object.keys(files)) if (p.startsWith("attempts/")) assert.ok(parseAttemptPath(p), p);

// 3) 再同步一次：仓库里已经有了，什么都不写
const again = await buildPlan({ gh, lc, repo: gh0.repo, shaCache: new Map() });
assert.equal(again.writes.length, 0);

// 4) 「做过的题」接口一直被限流：不等它，改成逐题查，结果一样
const ghB = mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": '{ "version": 1, "problems": {} }\n' });
const noProgress = async (q, v) => { if (q.includes("userProgressQuestionList")) throw new Error("力扣：🐸☕超出访问限制，请稍后再试"); return transport(q, v); };
const waitsB = [];
const planB = await buildPlan({ gh: createGitHub({ fetch: ghB.fetch, getToken: async () => "t" }), lc: createLeetCode(noProgress, { gap: 0, backoff: 1, onWait: (s) => waitsB.push(s) }), repo: ghB.repo });
assert.equal(waitsB.length, 0, "这个接口被限流时不等");
assert.equal(planB.added.length, 6);

// 5) 用户不勾某次提交：不导入，剩下的重新编号，编号记进 attempts/skip.txt，下次不再列出来
const { finalize } = await import("../sync.js");
const { parseSkip } = await import("../core.js");
const ghC = mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": '{ "version": 1, "problems": {} }\n' });
const ghc = createGitHub({ fetch: ghC.fetch, getToken: async () => "t" });
const lcC = createLeetCode(transport, { gap: 0 });
const planC = finalize(await buildPlan({ gh: ghc, lc: lcC, repo: ghC.repo }), new Set(["101", "201"]));
assert.deepEqual(planC.added.filter((f) => f.path.includes("0001")).map((f) => f.path), ["attempts/0001.两数之和/2026-11-10.1.通过.md"]);
assert.ok(!planC.changes.has(2), "第 2 题唯一的提交没勾，状态不动");
assert.deepEqual([...parseSkip(planC.writes.find((w) => w.path === "attempts/skip.txt").content)], ["101", "201"]);
await commitPlan({ gh: ghc, lc: lcC, plan: planC });
const againC = await buildPlan({ gh: ghc, lc: lcC, repo: ghC.repo });
assert.equal(againC.writes.length, 0, "skip.txt 里的提交不再列出来");

// 6) 读到一半力扣一直限流：停在那道题，前面读完的照常可以写，并告诉用户还剩几道
const ghD = mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": '{ "version": 1, "problems": {} }\n' });
const stuck = async (q, v) => { if (q.includes("submissionList") && v.questionSlug === "median-of-two-sorted-arrays") throw new Error("力扣：🐸☕超出访问限制，请稍后再试"); return transport(q, v); };
const planD = await buildPlan({ gh: createGitHub({ fetch: ghD.fetch, getToken: async () => "t" }), lc: createLeetCode(stuck, { gap: 0, backoff: 1 }), repo: ghD.repo });
assert.deepEqual(planD.partial && [planD.partial.done, planD.partial.total, planD.partial.next.id], [3, 5, 4]);
assert.deepEqual([...new Set(planD.added.map((f) => f.path.slice(9, 13)))], ["0001", "0002", "0003"]);

// 7) 增量同步：「做过的题」里最后提交的时间不比仓库里最新的记录新，就不去查那道题
let listCalls = 0;
const withLast = async (q, v) => {
  if (q.includes("userProgressQuestionList")) return { userProgressQuestionList: { totalNum: 5, questions: Object.keys(LC).map((s) => ({ titleSlug: s, numSubmitted: LC[s].length, lastSubmittedAt: new Date(Math.max(...LC[s].map((x) => Number(x.timestamp))) * 1000).toISOString() })) } };
  if (q.includes("submissionList")) listCalls++;
  return transport(q, v);
};
const planE = await buildPlan({ gh, lc: createLeetCode(withLast, { gap: 0 }), repo: gh0.repo });
assert.equal(planE.writes.length, 0);
assert.equal(listCalls, 1, "只有第 1 题要查（它最后那次是 MySQL，没导入，仓库里最新的记录比它早）");

// 8) 手写记录的代码少了力扣自带的注释头、改了空格，日期按 UTC 记成了前一天：仍然认得出来
const { matchExisting } = await import("../core.js");
const lcCode = "# Definition for a binary tree node.\n# class TreeNode:\n#     def __init__(self, x):\n#         self.val = x\n\nclass Solution:\n    def f(self, k, n):\n        return self.g(k+len(n)-1)\n";
const handCode = "class Solution:\n    def f(self, k, n):\n\n        return self.g(k + len(n) - 1)";
const at = T("2026-11-14T00:30:00+08:00");
const pairs = matchExisting(
  [{ path: "h1", code: handCode, verbatim: true, date: "2026-11-13", result: "通过" }, { path: "h2", code: "x = 1", verbatim: false, date: "2026-11-13", result: "超时" }],
  [
    { sub: { id: 1, status: "AC", timestamp: at }, detail: { code: lcCode } },
    { sub: { id: 2, status: "AC", timestamp: String(Number(at) + 60) }, detail: { code: lcCode } }, // 同一份代码又交了一次
    { sub: { id: 3, status: "TLE", timestamp: String(Number(at) + 120) }, detail: { code: "y = 2" } },
  ],
);
assert.deepEqual([...pairs].map(([p, s]) => `${p}→${s.id}`), ["h1→1", "h2→3"], "同一份代码交了两次时对上更早的那次；另一次照常导入");
assert.equal(matchExisting([{ path: "h", code: "return a + b", verbatim: true }], [{ sub: { id: 9, status: "AC", timestamp: at }, detail: { code: "return a - b" } }]).size, 0, "代码真的不一样就不认");

// 9) 规则的边界
assert.equal(cnParts(T("2026-01-01T00:00:00+08:00")).date, "2026-01-01");
assert.equal(fence("a ```` b"), "`````");
assert.equal(nextStatus({ status: "曾通过", updatedAt: "2026-11-10" }, [{ result: "通过", date: "2026-11-10" }]), null);
assert.deepEqual(nextStatus({ status: "曾通过", updatedAt: "2026-11-10" }, [{ result: "通过", date: "2026-11-11" }]), { status: "已通过", updatedAt: "2026-11-11" });
assert.equal(nextStatus({ status: "尝试过" }, [{ result: "答案错误", date: "2026-11-11" }]), null);
assert.equal(nextStatus(undefined, []), null);
console.log("sync tests passed");
