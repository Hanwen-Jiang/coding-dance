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
  { id: 11, name: "盛最多水的容器", slug: "container-with-most-water" },
  { id: 15, name: "三数之和", slug: "3sum" },
  { id: 238, name: "除了自身以外数组的乘积", slug: "product-of-array-except-self" },
] };
type S = { id: number; title: string; status: string; lang: string; langVerboseName?: string; runtime?: string; memory?: string; timestamp: string };
const BASE: S[] = [
  { id: 103, title: "两数之和", status: "AC", lang: "mysql", langVerboseName: "MySQL", timestamp: T("2026-11-10T10:09:00+08:00") },
  { id: 102, title: "两数之和", status: "AC", lang: "python3", runtime: "4 ms", memory: "17 MB", timestamp: T("2026-11-10T10:05:00+08:00") },
  { id: 101, title: "两数之和", status: "WA", lang: "python3", runtime: "N/A", memory: "N/A", timestamp: T("2026-11-10T10:00:00+08:00") },
  { id: 201, title: "两数相加", status: "RE", lang: "java", timestamp: T("2026-11-11T23:59:59+08:00") },
  { id: 301, title: "无重复字符的最长子串", status: "AC", lang: "cpp", timestamp: T("2026-11-12T00:00:01+08:00") },
  { id: 401, title: "寻找两个正序数组的中位数", status: "AC", lang: "golang", timestamp: T("2026-11-12T08:00:00+08:00") },
  { id: 501, title: "最长回文子串", status: "TLE", lang: "java", timestamp: T("2026-11-13T08:00:00+08:00") },
];
const CODE: Record<number, string> = { 101: "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 0]", 102: "class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        # ```三个反引号也不会弄坏代码块```\n        ..." };
const limitedMsg = "力扣：🐸☕超出访问限制，请稍后再试";

/** 假的力扣：subs 是它上面的全部提交；calls 记下各种查询发了几次；limit(query, variables) 返回 true 时这次请求被限流 */
function fakeLeetCode(subs: S[], { limit = (_q: string, _v: any): boolean => false, progress = null as null | { titleSlug: string; translatedTitle: string }[] } = {}) {
  const calls = { list: 0, detail: 0, progress: 0 };
  const sorted = () => [...subs].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  const transport = async (query: string, v: any): Promise<any> => {
    if (limit(query, v)) throw new Error(limitedMsg);
    if (query.includes("userProgressQuestionList")) {
      calls.progress++;
      return { userProgressQuestionList: { totalNum: (progress || []).length, questions: (progress || []).map((p) => ({ ...p, numSubmitted: 1 })) } };
    }
    if (query.includes("submissionList")) {
      calls.list++;
      assert.equal(v.questionSlug, "", "列提交时不指定题目：以力扣上的全部提交为准");
      const page = sorted().slice(v.offset, v.offset + v.limit);
      return { submissionList: { lastKey: "k" + v.offset, hasNext: v.offset + v.limit < subs.length, submissions: page.map((s) => ({ ...s, isPending: "Not Pending", statusDisplay: s.status })) } };
    }
    if (query.includes("submissionDetail")) {
      calls.detail++;
      const s = subs.find((x) => String(x.id) === v.id)!;
      return { submissionDetail: { id: v.id, lang: s.lang, code: CODE[s.id] ?? `int x${s.id} = 0;`, passedTestCaseCnt: s.status === "AC" ? 63 : 12, totalTestCaseCnt: 63, runtime: s.runtime || "N/A", memory: s.memory || "N/A", runtimePercentile: 88.888, memoryPercentile: 0 } };
    }
    throw new Error("unexpected query");
  };
  return { transport, calls };
}
const empty = () => mockGitHub({ "hot100.json": JSON.stringify(hot), "progress.json": '{ "version": 1, "problems": {} }\n' });

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

// 1) 第一次同步：读代码时被限流两次，等一等接着读
let limited = 2;
const waits: number[] = [];
const lc0 = fakeLeetCode(BASE, { limit: (q) => q.includes("submissionDetail") && limited-- > 0 });
const lc = createLeetCode(lc0.transport, { gap: 0, backoff: 1, onWait: (s) => waits.push(s) });
const cache = new Map();
const steps: { done: number; total: number }[] = [];
const plan = await buildPlan({ repo: client(gh0), lc, cache, onProgress: (_m, s) => { if (s) steps.push(s); } });
assert.deepEqual(plan.added.map((f) => f.path).sort(), [
  "attempts/0001.两数之和/2026-11-10.2.答案错误.md", // 当天已有一条手写的，序号接着排
  "attempts/0001.两数之和/2026-11-10.3.通过.md",
  "attempts/0002.两数相加/2026-11-11.1.运行出错.md", // 23:59:59 北京时间，日期不能算到第二天
  "attempts/0003.无重复字符的最长子串/2026-11-12.1.通过.md",
]);
assert.deepEqual(plan.perProblem.map((p) => p.problem.id), [5, 4, 3, 2, 1], "最近提交的题排在前面");
assert.equal(waits.length, 2, "被限流两次，各等了一次");
assert.deepEqual(plan.totals, { all: 7, hot: 7, problems: 5, known: 0, fresh: 7 });
assert.deepEqual(steps.at(-1), { done: 6, total: 6 }, "进度按要读的代码数算（MySQL 那次不读）");
const link = Object.fromEntries(plan.linked.map((f) => [f.path, f]));
assert.deepEqual(Object.keys(link).sort(), ["attempts/0004.寻找两个正序数组的中位数/2026-11-12.1.通过.md", "attempts/0005.最长回文子串/2026-11-13.1.超时.md"]);
assert.equal(link["attempts/0005.最长回文子串/2026-11-13.1.超时.md"].content,
  "---\r\nlang: java\r\nsource: leetcode.cn\r\nsubmission: 501\r\nsubmittedAt: 2026-11-13T08:00:00+08:00\r\n---\r\n" + hand501.slice("---\r\nlang: java\r\n---\r\n".length));
assert.equal(frontMatter(link["attempts/0004.寻找两个正序数组的中位数/2026-11-12.1.通过.md"].content).submission, "401");
assert.equal(plan.skipped.length, 1);
assert.match(plan.skipped[0].reason, /MySQL/);
assert.deepEqual(Object.fromEntries([...plan.changes].map(([k, v]) => [k, v.status])), { 1: "已通过", 2: "尝试过", 3: "已通过" });
const f102 = plan.added.find((f) => f.id === "102")!.content;
assert.equal(frontMatter(f102).submission, "102");
assert.equal(frontMatter(f102).submittedAt, "2026-11-10T10:05:00+08:00");
assert.ok(f102.includes("````python\n"), "代码里有三个反引号时围栏要用四个");
assert.ok(f102.includes("通过 · 用例 63 / 63 · 执行用时 4 ms（击败 88.9%） · 内存 17 MB\n"));
assert.ok(plan.added.find((f) => f.id === "101")!.content.includes("解答错误 · 用例 12 / 63\n"));

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
assert.match(gh0.log()[0], /力扣上热题 100 共 7 次提交（5 道题），同步前仓库里已有 0 次/);
for (const p of Object.keys(files)) if (p.startsWith("attempts/")) assert.ok(parseAttemptPath(p), p);

// 3) 再同步一次：只翻一遍提交列表，一份代码都不用读，什么都不写
const lc3 = fakeLeetCode(BASE);
const again = await buildPlan({ repo: client(gh0), lc: createLeetCode(lc3.transport, { gap: 0 }) });
assert.equal(again.writes.length, 0);
assert.deepEqual([lc3.calls.list, lc3.calls.detail, lc3.calls.progress], [1, 0, 0]);
assert.deepEqual(again.totals, { all: 7, hot: 7, problems: 5, known: 6, fresh: 1 }, "只剩 MySQL 那次导不进来");

// 4) 以力扣为准：新做了一道仓库里完全没有记录的题（第 11 题），同时「做过的题」接口被限流、
//    读代码的额度只够读一份。新题必须第一个被读到并同步，不能因为仓库里没有它的记录就排到后面
const newer: S[] = [...BASE, { id: 601, title: "盛最多水的容器", status: "AC", lang: "python3", timestamp: T("2026-11-14T09:00:00+08:00") }, { id: 9001, title: "不在热题里的题", status: "AC", lang: "python3", timestamp: T("2026-11-14T08:00:00+08:00") }];
let budget = 1;
const lc4 = fakeLeetCode(newer, { limit: (q) => q.includes("userProgressQuestionList") || (q.includes("submissionDetail") && budget-- <= 0) });
const waits4: number[] = [];
const plan4 = await buildPlan({ repo: client(empty()), lc: createLeetCode(lc4.transport, { gap: 0, backoff: 1, retries: 1, onWait: (s) => waits4.push(s) }) });
assert.deepEqual(plan4.added.map((f) => f.path), ["attempts/0011.盛最多水的容器/2026-11-14.1.通过.md"]);
assert.equal(plan4.changes.get(11)?.status, "已通过");
assert.deepEqual(plan4.partial && [plan4.partial.done, plan4.partial.total, plan4.partial.next.id, plan4.partial.left], [1, 6, 5, 6], "读完 1 道，还剩 5 道题、6 份代码没读");
assert.deepEqual(plan4.totals, { all: 9, hot: 8, problems: 6, known: 0, fresh: 8 });

// 5) 用户不勾某次提交：不导入，剩下的重新编号，编号记进 attempts/skip.txt，下次不再列出来
const ghC = empty();
const lcC = createLeetCode(fakeLeetCode(BASE).transport, { gap: 0 });
const planC = finalize(await buildPlan({ repo: client(ghC), lc: lcC }), new Set(["101", "201"]));
assert.deepEqual(planC.added.filter((f) => f.path.includes("0001")).map((f) => f.path), ["attempts/0001.两数之和/2026-11-10.1.通过.md"]);
assert.ok(!planC.changes.has(2), "第 2 题唯一的提交没勾，状态不动");
assert.deepEqual([...parseSkip(planC.writes.find((w) => w.path === "attempts/skip.txt")!.content)].sort(), ["101", "201"]);
await commitPlan({ repo: client(ghC), lc: lcC, plan: planC });
assert.equal((await buildPlan({ repo: client(ghC), lc: lcC })).writes.length, 0, "skip.txt 里的提交不再列出来");

// 6) 只用进度仓不支持的语言做过的题：导不进记录，但状态要跟力扣一致
const only15: S[] = [{ id: 701, title: "三数之和", status: "AC", lang: "mysql", langVerboseName: "MySQL", timestamp: T("2026-11-14T10:00:00+08:00") }];
const plan6 = await buildPlan({ repo: client(empty()), lc: createLeetCode(fakeLeetCode(only15).transport, { gap: 0 }) });
assert.equal(plan6.added.length, 0);
assert.deepEqual(plan6.changes.get(15), { status: "已通过", updatedAt: "2026-11-14" });
assert.deepEqual(plan6.writes.map((w) => w.path), ["progress.json"]);

// 7) 力扣改过题名：按名字对不上时，用「做过的题」里的 slug 对上
const renamed: S[] = [{ id: 801, title: "除自身以外数组的乘积", status: "AC", lang: "python3", timestamp: T("2026-11-14T11:00:00+08:00") }];
const plan7 = await buildPlan({ repo: client(empty()), lc: createLeetCode(fakeLeetCode(renamed, { progress: [{ titleSlug: "product-of-array-except-self", translatedTitle: "除自身以外数组的乘积" }] }).transport, { gap: 0 }) });
assert.deepEqual(plan7.added.map((f) => f.path), ["attempts/0238.除了自身以外数组的乘积/2026-11-14.1.通过.md"]);

// 7b) 提交列表翻到第二页就一直被限流：读到的第一页（最新的 20 条）照常同步，并告诉用户更早的这次没看到
const fillers: S[] = Array.from({ length: 19 }, (_, k) => ({ id: 950 + k, title: "不在热题里的题", status: "AC", lang: "python3", timestamp: String(Number(T("2026-11-14T00:00:00+08:00")) + k * 60) }));
const cutList: S[] = [...BASE, ...fillers, { id: 602, title: "盛最多水的容器", status: "AC", lang: "python3", timestamp: T("2026-11-14T12:00:00+08:00") }];
const lcCut = fakeLeetCode(cutList, { limit: (q, v) => q.includes("submissionList") && v.offset >= 20 });
const planCut = await buildPlan({ repo: client(empty()), lc: createLeetCode(lcCut.transport, { gap: 0, backoff: 1, retries: 1 }) });
assert.deepEqual(planCut.added.map((f) => f.path), ["attempts/0011.盛最多水的容器/2026-11-14.1.通过.md"], "只同步读到的那一页里的题");
assert.deepEqual(planCut.listCut, { read: 20, oldest: Number(T("2026-11-14T00:00:00+08:00")) });
assert.equal(planCut.partial, null);
assert.match((await (async () => { const g = empty(); await commitPlan({ repo: client(g), lc: createLeetCode(lcCut.transport, { gap: 0, backoff: 1, retries: 1 }), plan: planCut }); return g.log()[0]; })()), /力扣的提交列表只读到最近 20 条（最早到 2026-11-14）/);
await assert.rejects(buildPlan({ repo: client(empty()), lc: createLeetCode(fakeLeetCode(BASE, { limit: (q) => q.includes("submissionList") }).transport, { gap: 0, backoff: 1, retries: 1 }) }), /太频繁/, "第一页就读不到：报错，不写任何东西");

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
const rejects = (fs: { path: string; content: string }[], re: RegExp) => assert.throws(() => validateWrites({ ...ok, files: fs }), (e: unknown) => e instanceof SyncError && re.test(e.message));
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
assert.deepEqual({ ...sandbox.opened }, { url: SITE + "/sync/?from=leetcode", name: "hot100-sync" });
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
