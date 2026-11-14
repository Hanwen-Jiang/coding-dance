// node lib/sync/test/sync.test.ts：用假的力扣数据和假的 GitHub 跑一遍同步（页面上的流程 + 服务端的检查和写入 + 书签）
import assert from "node:assert/strict";
import vm from "node:vm";
import { buildPlan, commitPlan, ConflictError, finalize, type RepoClient } from "../plan.ts";
import { createLeetCode } from "../leetcode.ts";
import { commitWrites, readBlobs, readRepo, SyncError, validateWrites } from "../server.ts";
import { cnParts, fence, frontMatter, matchExisting, nextStatus, parseAttemptPath, parseSkip } from "../core.ts";
import { bookmarklet, bookmarkletSource } from "../bookmarklet.ts";
import { mockGitHub } from "./mock-github.ts";

/** 页面用的进度仓接口，背后直接是服务端的 readRepo / readBlobs / commitWrites（和网站上一样经过服务端的检查） */
const client = (gh: ReturnType<typeof mockGitHub>): RepoClient => ({
  head: () => readRepo(gh.api, gh.repo),
  texts: (shas) => readBlobs(gh.api, gh.repo, shas),
  commit: async (args) => { const r = await commitWrites(gh.api, gh.repo, args); if ("conflict" in r) throw new ConflictError("conflict"); return r; },
});

const T = (s: string) => String(Math.floor(Date.parse(s) / 1000));
const hot = { version: 1, problems: [
  { id: 1, name: "两数之和", slug: "two-sum" },
  { id: 2, name: "两数相加", slug: "add-two-numbers" },
  { id: 3, name: "无重复字符的最长子串", slug: "longest-substring-without-repeating-characters" },
  { id: 4, name: "寻找两个正序数组的中位数", slug: "median-of-two-sorted-arrays" },
  { id: 5, name: "最长回文子串", slug: "longest-palindromic-substring" },
] };
type S = { id: number; status: string; lang: string; langVerboseName?: string; runtime?: string; memory?: string; timestamp: string };
const LC: Record<string, S[]> = {
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
const CODE: Record<number, string> = { 101: "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 0]", 102: "class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        # ```三个反引号也不会弄坏代码块```\n        ..." };
const transport = async (query: string, v: any): Promise<any> => {
  if (query.includes("userProgressQuestionList")) return { userProgressQuestionList: { totalNum: 5, questions: Object.keys(LC).map((s) => ({ titleSlug: s, numSubmitted: LC[s].length })) } };
  if (query.includes("submissionList")) return { submissionList: { lastKey: null, hasNext: false, submissions: LC[v.questionSlug].map((s) => ({ ...s, isPending: "Not Pending", statusDisplay: s.status })) } };
  if (query.includes("submissionDetail")) {
    const s = Object.values(LC).flat().find((x) => String(x.id) === v.id)!;
    return { submissionDetail: { id: v.id, lang: s.lang, code: CODE[s.id] ?? `int x${s.id} = 0;`, passedTestCaseCnt: s.status === "AC" ? 63 : 12, totalTestCaseCnt: 63, runtime: s.runtime || "N/A", memory: s.memory || "N/A", runtimePercentile: 88.888, memoryPercentile: 0 } };
  }
  throw new Error("unexpected query");
};
const limitedMsg = "力扣：🐸☕超出访问限制，请稍后再试";

const manual = "---\nlang: python\n---\n\n## 想法\n\n先自己想了一遍暴力。\n";
const hand501 = "---\r\nlang: java\r\n---\r\n\r\n## 错在哪里\r\n\r\n死循环。\r\n\r\n## 代码\r\n\r\n```java\r\nint x501 = 0;   \r\n```\r\n";
const hand401 = "---\nlang: go\nverbatim: false\n---\n\n## 说明\n\n整理过的写法。\n\n## 代码\n\n```go\nfunc f() {}\n```\n";
const prog0 = JSON.stringify({ version: 1, problems: { 3: { status: "曾通过", updatedAt: "2026-11-01" }, 4: { status: "曾通过" }, 5: { status: "已通过", updatedAt: "2026-10-01" } } }, null, 2) + "\n";
const gh0 = mockGitHub({
  "hot100.json": JSON.stringify(hot), "progress.json": prog0,
  "attempts/0001.两数之和/2026-11-10.1.思路不成立.md": manual,
  "attempts/0005.最长回文子串/2026-11-13.1.超时.md": hand501,
  "attempts/0004.寻找两个正序数组的中位数/2026-11-12.1.通过.md": hand401,
});
let limited = 2;
const waits: number[] = [];
const flaky = async (q: string, v: any) => { if (q.includes("submissionList") && limited-- > 0) throw new Error(limitedMsg); return transport(q, v); };
const lc = createLeetCode(flaky, { gap: 0, backoff: 1, onWait: (s) => waits.push(s) });
const cache = new Map();

// 1) 第一次同步
const plan = await buildPlan({ repo: client(gh0), lc, cache });
assert.deepEqual(plan.added.map((f) => f.path), [
  "attempts/0001.两数之和/2026-11-10.2.答案错误.md", // 当天已有一条手写的，序号接着排
  "attempts/0001.两数之和/2026-11-10.3.通过.md",
  "attempts/0002.两数相加/2026-11-11.1.运行出错.md", // 23:59:59 北京时间，日期不能算到第二天
  "attempts/0003.无重复字符的最长子串/2026-11-12.1.通过.md",
]);
assert.equal(waits.length, 2, "被限流两次，各等了一次");
const link = Object.fromEntries(plan.linked.map((f) => [f.path, f]));
assert.deepEqual(Object.keys(link).sort(), ["attempts/0004.寻找两个正序数组的中位数/2026-11-12.1.通过.md", "attempts/0005.最长回文子串/2026-11-13.1.超时.md"]);
assert.equal(link["attempts/0005.最长回文子串/2026-11-13.1.超时.md"].content,
  "---\r\nlang: java\r\nsource: leetcode.cn\r\nsubmission: 501\r\nsubmittedAt: 2026-11-13T08:00:00+08:00\r\n---\r\n" + hand501.slice("---\r\nlang: java\r\n---\r\n".length));
assert.equal(frontMatter(link["attempts/0004.寻找两个正序数组的中位数/2026-11-12.1.通过.md"].content).submission, "401");
assert.equal(plan.skipped.length, 1);
assert.match(plan.skipped[0].reason, /MySQL/);
assert.deepEqual(Object.fromEntries([...plan.changes].map(([k, v]) => [k, v.status])), { 1: "已通过", 2: "尝试过", 3: "已通过" });
const f102 = plan.added[1].content;
assert.equal(frontMatter(f102).submission, "102");
assert.equal(frontMatter(f102).submittedAt, "2026-11-10T10:05:00+08:00");
assert.ok(f102.includes("````python\n"), "代码里有三个反引号时围栏要用四个");
assert.ok(f102.includes("通过 · 用例 63 / 63 · 执行用时 4 ms（击败 88.9%） · 内存 17 MB\n"));
assert.ok(plan.added[0].content.includes("解答错误 · 用例 12 / 63\n"));

// 2) 写入时网站刚好改了别的题的状态：重新读一遍，要导入的没变，照常写入，网站的改动保留
gh0.push("progress.json", JSON.stringify({ ...JSON.parse(prog0), problems: { ...JSON.parse(prog0).problems, 99: { status: "已通过" } } }, null, 2) + "\n", "进度：第 99 题 → 已通过");
const res = await commitPlan({ repo: client(gh0), lc, plan, cache });
assert.ok("sha" in res && res.sha);
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
assert.equal((await buildPlan({ repo: client(gh0), lc })).writes.length, 0);

// 4) 「做过的题」接口一直被限流：不等它，改成逐题查，结果一样
const ghB = mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": '{ "version": 1, "problems": {} }\n' });
const waitsB: number[] = [];
const planB = await buildPlan({ repo: client(ghB), lc: createLeetCode(async (q, v) => { if (q.includes("userProgressQuestionList")) throw new Error(limitedMsg); return transport(q, v); }, { gap: 0, backoff: 1, onWait: (s) => waitsB.push(s) }) });
assert.equal(waitsB.length, 0, "这个接口被限流时不等");
assert.equal(planB.added.length, 6);

// 5) 用户不勾某次提交：不导入，剩下的重新编号，编号记进 attempts/skip.txt，下次不再列出来
const ghC = mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": '{ "version": 1, "problems": {} }\n' });
const lcC = createLeetCode(transport, { gap: 0 });
const planC = finalize(await buildPlan({ repo: client(ghC), lc: lcC }), new Set(["101", "201"]));
assert.deepEqual(planC.added.filter((f) => f.path.includes("0001")).map((f) => f.path), ["attempts/0001.两数之和/2026-11-10.1.通过.md"]);
assert.ok(!planC.changes.has(2), "第 2 题唯一的提交没勾，状态不动");
assert.deepEqual([...parseSkip(planC.writes.find((w) => w.path === "attempts/skip.txt")!.content)], ["101", "201"]);
await commitPlan({ repo: client(ghC), lc: lcC, plan: planC });
assert.equal((await buildPlan({ repo: client(ghC), lc: lcC })).writes.length, 0, "skip.txt 里的提交不再列出来");

// 6) 读到一半力扣一直限流：停在那道题，前面读完的照常可以写，并告诉用户还剩几道
const ghD = mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": '{ "version": 1, "problems": {} }\n' });
const planD = await buildPlan({ repo: client(ghD), lc: createLeetCode(async (q, v) => { if (q.includes("submissionList") && v.questionSlug === "median-of-two-sorted-arrays") throw new Error(limitedMsg); return transport(q, v); }, { gap: 0, backoff: 1 }) });
assert.deepEqual(planD.partial && [planD.partial.done, planD.partial.total, planD.partial.next.id], [3, 5, 4]);
assert.deepEqual([...new Set(planD.added.map((f) => f.path.slice(9, 13)))], ["0001", "0002", "0003"]);

// 7) 增量同步：「做过的题」里最后提交的时间不比仓库里最新的记录新，就不去查那道题
let listCalls = 0;
const withLast = async (q: string, v: any) => {
  if (q.includes("userProgressQuestionList")) return { userProgressQuestionList: { totalNum: 5, questions: Object.keys(LC).map((s) => ({ titleSlug: s, numSubmitted: LC[s].length, lastSubmittedAt: new Date(Math.max(...LC[s].map((x) => Number(x.timestamp))) * 1000).toISOString() })) } };
  if (q.includes("submissionList")) listCalls++;
  return transport(q, v);
};
assert.equal((await buildPlan({ repo: client(gh0), lc: createLeetCode(withLast, { gap: 0 }) })).writes.length, 0);
assert.equal(listCalls, 1, "只有第 1 题要查（它最后那次是 MySQL，没导入，仓库里最新的记录比它早）");

// 8) 手写记录少了力扣自带的注释头、改了空格，日期按 UTC 记成了前一天：仍然认得出来；代码真不一样就不认
const lcCode = "# Definition for a binary tree node.\n# class TreeNode:\n#     def __init__(self, x):\n\nclass Solution:\n    def f(self, k, n):\n        return self.g(k+len(n)-1)\n";
const at = T("2026-11-14T00:30:00+08:00");
const pairs = matchExisting(
  [{ path: "h1", code: "class Solution:\n    def f(self, k, n):\n\n        return self.g(k + len(n) - 1)", verbatim: true, date: "2026-11-13", result: "通过" }, { path: "h2", code: "x = 1", verbatim: false, date: "2026-11-13", result: "超时" }],
  [{ sub: { id: 1, status: "AC", lang: "python3", timestamp: at }, detail: { code: lcCode } }, { sub: { id: 2, status: "AC", lang: "python3", timestamp: String(Number(at) + 60) }, detail: { code: lcCode } }, { sub: { id: 3, status: "TLE", lang: "python3", timestamp: String(Number(at) + 120) }, detail: { code: "y = 2" } }],
);
assert.deepEqual([...pairs].map(([p, s]) => `${p}→${s.id}`), ["h1→1", "h2→3"]);
assert.equal(matchExisting([{ path: "h", code: "return a + b", verbatim: true }], [{ sub: { id: 9, status: "AC", lang: "python3", timestamp: at }, detail: { code: "return a - b" } }]).size, 0);

// 9) 服务端只肯写三类文件，内容不合规则整个拒绝
const ok = { branch: "main", parent: "a".repeat(40), baseTree: "b".repeat(40), message: "m" };
const rejects = (files: { path: string; content: string }[], re: RegExp) => assert.throws(() => validateWrites({ ...ok, files }), (e: unknown) => e instanceof SyncError && re.test(e.message));
rejects([{ path: "solutions/python/0001.两数之和.py", content: "x" }], /不能写/);
rejects([{ path: ".github/workflows/x.yml", content: "x" }], /不能写/);
rejects([{ path: "attempts/0001.两数之和/2026-11-10.1.通过.md", content: "没有设置" }], /---/);
rejects([{ path: "attempts/0001.两数之和/2026-11-10.1.通过.md", content: "---\nlang: python\nsubmission: abc\n---\n" }], /submission/);
rejects([{ path: "progress.json", content: '{ "version": 1, "problems": { "1": { "status": "做过" } } }' }], /第 1 题/);
rejects([{ path: "attempts/skip.txt", content: "123\nabc\n" }], /skip/);
assert.doesNotThrow(() => validateWrites({ ...ok, files: [{ path: "attempts/skip.txt", content: "# 注释\n123\n" }] }));
assert.throws(() => validateWrites({ ...ok, parent: "../x", files: [{ path: "progress.json", content: "{}" }] }), /parent/);
await assert.rejects(readBlobs(gh0.api, gh0.repo, ["../../x"]), /参数不对/);

// 10) 书签：只回应本站同步页的消息，只转发只读查询
const SITE = "https://leetcode.cgent.link";
const href = bookmarklet(SITE);
assert.ok(href.startsWith("javascript:") && href.length < 3000, `书签长度 ${href.length}`);
const listeners: ((e: any) => void)[] = [], sent: any[] = [], fetched: any[] = [];
// 沙箱里造出来的对象来自另一个 realm，转成普通对象再比
const popup = { postMessage: (m: any, o: string) => sent.push(JSON.parse(JSON.stringify({ m, o }))) };
const sandbox: any = {
  location: { hostname: "leetcode.cn" }, document: { cookie: "a=1; csrftoken=TOKEN; b=2" },
  alert: (m: string) => { throw new Error("alert: " + m); },
  addEventListener: (_t: string, fn: (e: any) => void) => listeners.push(fn),
  fetch: async (url: string, init: any) => { fetched.push(JSON.parse(JSON.stringify({ url, init }))); return { status: 200, text: async () => JSON.stringify({ data: { ok: 1 } }) }; },
  JSON, RegExp, String,
};
sandbox.window = sandbox;
sandbox.window.open = (url: string, name: string) => { sandbox.opened = { url, name }; return popup; };
vm.runInNewContext(`${bookmarkletSource.replace(/\n/g, "")}(${JSON.stringify(SITE)})`, sandbox);
assert.deepEqual(sandbox.opened, { url: SITE + "/sync/?from=leetcode", name: "hot100-sync" });
const fire = async (data: any, origin = SITE, source: any = popup) => { for (const fn of listeners) fn({ data, origin, source }); await new Promise((r) => setTimeout(r, 10)); };
await fire({ type: "hot100:hello" });
assert.deepEqual(sent.pop(), { m: { type: "hot100:ready" }, o: SITE });
await fire({ type: "hot100:query", id: 7, query: "query { userStatus { username } }", variables: {} });
assert.equal(fetched.length, 1);
assert.equal(fetched[0].url, "/graphql/");
assert.equal(fetched[0].init.headers["x-csrftoken"], "TOKEN");
assert.deepEqual(sent.pop(), { m: { type: "hot100:result", id: 7, res: { status: 200, json: { data: { ok: 1 } } } }, o: SITE });
await fire({ type: "hot100:query", id: 8, query: "mutation { deleteEverything }", variables: {} });
assert.equal(fetched.length, 1, "mutation 不转发");
assert.match(sent.pop().m.res.text, /只读/);
await fire({ type: "hot100:query", id: 9, query: "query { x }" }, "https://evil.example");
await fire({ type: "hot100:query", id: 10, query: "query { x }" }, SITE, { postMessage() {} });
assert.equal(fetched.length, 1, "别的来源、别的窗口发来的消息不理");
vm.runInNewContext(`${bookmarkletSource.replace(/\n/g, "")}(${JSON.stringify(SITE)})`, sandbox);
assert.equal(listeners.length, 1, "再点一次书签不会重复监听");

// 11) 规则的边界
assert.equal(cnParts(T("2026-01-01T00:00:00+08:00")).date, "2026-01-01");
assert.equal(fence("a ```` b"), "`````");
assert.equal(nextStatus({ status: "曾通过", updatedAt: "2026-11-10" }, [{ result: "通过", date: "2026-11-10" }]), null);
assert.deepEqual(nextStatus({ status: "曾通过", updatedAt: "2026-11-10" }, [{ result: "通过", date: "2026-11-11" }]), { status: "已通过", updatedAt: "2026-11-11" });
assert.equal(nextStatus({ status: "尝试过" }, [{ result: "答案错误", date: "2026-11-11" }]), null);
assert.equal(nextStatus(undefined, []), null);
console.log("sync tests passed");
