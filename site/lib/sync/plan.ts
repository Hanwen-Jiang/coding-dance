// 同步的流程：先读力扣上的全部提交和进度仓（唯一的数据源），对账，算出可以写什么（不写任何东西）；
// 用户勾选、确认后，一次提交写进仓库。
import {
  LC_LANG, SKIP_FILE, addSubmissionMeta, cnParts, matchExisting, nextStatus, parseAttemptPath, parseSkip, planProblem, readAttempt, resultOf, writeProgress, writeSkip,
  type NewFile, type Problem, type ProgressEntry, type ProgressFile, type Result, type Skipped, type Sub, type SubWithDetail,
} from "./core.ts";
import { isRateLimited, type LeetCode } from "./leetcode.ts";

export class ConflictError extends Error {}

/** 读写用户进度仓的接口（网站上由服务端用用户自己的 GitHub 登录代办，测试里换成假的） */
export interface RepoClient {
  /** 默认分支当前的 commit、tree 和所有文件 */
  head(): Promise<{ repo: string; branch: string; commit: string; tree: string; files: { path: string; sha: string }[] }>;
  /** 按 blob sha 读文件内容，一次可以读多个 */
  texts(shas: string[]): Promise<Record<string, string>>;
  /** 一次提交写入多个文件。分支在这期间被移动过要抛 ConflictError */
  commit(args: { branch: string; parent: string; baseTree: string; files: { path: string; content: string }[]; message: string }): Promise<{ sha: string; url: string }>;
}

export interface Linked { path: string; content: string; id: string }
interface ProblemPlan {
  problem: Problem; files: NewFile[]; linked: Linked[]; existing: string[]; subs: SubWithDetail[]; known: Set<string>;
  /** 没法导入（进度仓不支持的语言）但确实提交过的结果：只用来算状态 */
  uncounted: { result: Result; date: string }[];
}
/** 力扣上的情况：一共多少次提交、热题 100 里多少次、多少道题，其中多少已经在仓库里 */
export interface Totals { all: number; hot: number; problems: number; known: number; fresh: number }
interface Base {
  head: Awaited<ReturnType<RepoClient["head"]>>;
  progress: ProgressFile; skipText: string | null;
  problems: ProblemPlan[]; skipped: (Skipped & { problem: Problem })[];
  /** 读代码读到一半一直被限流：done / total 是读完的题数 / 有新提交的题数，left 是还没读的新提交数 */
  partial: { done: number; total: number; next: Problem; left: number } | null;
  /** 力扣的提交列表翻到一半一直被限流：read 是读到的条数，oldest 是读到的最早一条的时间（秒）。更早的提交这次没看到 */
  listCut: { read: number; oldest: number } | null;
  totals: Totals;
}
export type Plan = ReturnType<typeof finalize>;
export type Cached = { text: string } & ReturnType<typeof readAttempt>;
export type Progress = (message: string, step?: { done: number; total: number }) => void;

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 读力扣和仓库，对账，列出每道题可以新增的记录。
 *
 * 以力扣为准找「有什么」：先把力扣上的全部提交列出来（所有题，从新到旧），所以新做的题一定会被看到，
 * 不依赖仓库里已经记了哪些题。
 * 以仓库为准判断「导入过没有」：写了 submission 编号的记录直接认；没写编号的（手写的）按代码去和力扣提交对，
 * 对上了就只给它补编号；attempts/skip.txt 里的编号是用户说过不要导入的。
 * 只有仓库里没有的提交才去取代码，最近提交的题先取：被限流只能读一部分时，先拿到的是最近做的题。
 *
 * cache：blob sha → 记录内容，只是仓库内容的缓存（内容变了 sha 就变）。
 */
export async function buildPlan({ repo, lc, cache = new Map<string, Cached>(), onProgress = () => {}, only = null }: {
  repo: RepoClient; lc: LeetCode; cache?: Map<string, Cached>; onProgress?: Progress; only?: Set<number> | null;
}) {
  onProgress("读取进度仓");
  const head = await repo.head();
  const sha = new Map(head.files.map((f) => [f.path, f.sha]));
  if (!sha.has("hot100.json")) throw new Error("进度仓里没有 hot100.json：确认这个仓库是用模板建的");
  const read = async (paths: string[]) => {
    const want = paths.filter((p) => sha.has(p));
    const got = await repo.texts(want.map((p) => sha.get(p)!));
    return Object.fromEntries(want.map((p) => [p, got[sha.get(p)!]]));
  };
  const top = await read(["hot100.json", "progress.json", SKIP_FILE]);
  const hot: Problem[] = JSON.parse(top["hot100.json"]).problems;
  const progress: ProgressFile = top["progress.json"] ? JSON.parse(top["progress.json"]) : { version: 1, problems: {} };
  const skipText = top[SKIP_FILE] ?? null;
  const skipIds = parseSkip(skipText);
  const attempts = new Map<number, { path: string; sha: string }[]>();
  for (const f of head.files) {
    const a = parseAttemptPath(f.path);
    if (a) (attempts.get(a.id) || attempts.set(a.id, []).get(a.id)!).push(f);
  }

  // 力扣上的全部提交，按题目名对到热题 100 的题
  onProgress("读取力扣上的提交列表");
  const { subs: all, complete } = await lc.all((n) => onProgress(`读取力扣上的提交列表（已读 ${n} 条）`));
  // 列表没读完也照常往下做：读到的是最新的那部分，先把它们同步了
  const listCut = complete ? null : { read: all.length, oldest: Math.min(...all.map((s) => Number(s.timestamp))) };
  const byTitle = new Map(hot.map((h) => [norm(h.name), h]));
  if (all.some((s) => !byTitle.has(norm(s.title || "")))) {
    // 有对不上名字的题（不在热题 100 里，或者力扣改过题名）：用「做过的题」里的 slug 再对一遍。这个接口被限流就算了，按名字对
    try {
      const bySlug = new Map(hot.map((h) => [h.slug, h]));
      for (const q of await lc.progress()) { const h = bySlug.get(q.titleSlug); if (h && q.translatedTitle) byTitle.set(norm(q.translatedTitle), h); }
    } catch (e) { if (!isRateLimited(e)) throw e; }
  }
  const byProblem = new Map<number, { problem: Problem; subs: Sub[] }>();
  for (const s of all) {
    const h = byTitle.get(norm(s.title || ""));
    if (!h || (only && !only.has(h.id))) continue;
    (byProblem.get(h.id) || byProblem.set(h.id, { problem: h, subs: [] }).get(h.id)!).subs.push(s);
  }

  // 这些题在仓库里已有的记录（每次 40 个）
  const need = [...byProblem.keys()].flatMap((id) => attempts.get(id) || []).filter((f) => !cache.has(f.sha));
  for (let k = 0; k < need.length; k += 40) {
    onProgress(`读取进度仓里已有的尝试记录（${Math.min(k + 40, need.length)} / ${need.length}）`, { done: Math.min(k + 40, need.length), total: need.length });
    const got = await repo.texts(need.slice(k, k + 40).map((f) => f.sha));
    for (const [s, text] of Object.entries(got)) cache.set(s, { text, ...readAttempt(text) });
  }

  // 对账：每道题里仓库没有的提交
  const todo = [];
  let hotCount = 0, knownCount = 0;
  for (const { problem, subs } of byProblem.values()) {
    const existing = (attempts.get(problem.id) || []).map((f) => ({ ...f, ...parseAttemptPath(f.path)!, ...cache.get(f.sha)! }));
    const known = new Set([...existing.map((f) => f.submission).filter((x): x is string => !!x), ...skipIds]);
    const fresh = subs.filter((s) => !known.has(String(s.id)));
    hotCount += subs.length; knownCount += subs.length - fresh.length;
    if (fresh.length) todo.push({ problem, existing, known, fresh, newest: Math.max(...fresh.map((s) => Number(s.timestamp))) });
  }
  todo.sort((a, b) => b.newest - a.newest); // 最近提交的题先读
  const wanted = (s: Sub) => !!LC_LANG[s.lang] && (!s.isPending || s.isPending === "Not Pending");
  const totalDetails = todo.reduce((n, t) => n + t.fresh.filter(wanted).length, 0);
  const totals: Totals = { all: all.length, hot: hotCount, problems: byProblem.size, known: knownCount, fresh: hotCount - knownCount };

  const problems: ProblemPlan[] = [], skipped: Base["skipped"] = [];
  let partial: Base["partial"] = null, doneDetails = 0;
  for (const [i, t] of todo.entries()) {
    // 先把这道题的新提交的代码全部读完；中途一直被限流就停在这里：前面读完的题照常写，这道题和后面的下次同步再读
    const subs: SubWithDetail[] = [];
    try {
      for (const s of t.fresh) {
        if (!wanted(s)) { subs.push({ sub: s, detail: { lang: s.lang } }); continue; }
        onProgress(`读取第 ${t.problem.id} 题「${t.problem.name}」的代码（第 ${i + 1} / ${todo.length} 道有新提交的题）`, { done: doneDetails, total: totalDetails });
        subs.push({ sub: s, detail: await lc.detail(s.id) });
        doneDetails++;
      }
    } catch (e) {
      if (!isRateLimited(e)) throw e;
      // 这道题读了一半的代码不用：它和后面的题下次同步再读
      partial = { done: i, total: todo.length, next: t.problem, left: todo.slice(i).reduce((n, x) => n + x.fresh.filter(wanted).length, 0) };
      break;
    }
    // 手写的记录先和力扣提交对上，对上的只补编号
    const pairs = matchExisting(t.existing.filter((f) => !f.submission), subs);
    const linked = [...pairs].map(([path, sub]) => ({ path, content: addSubmissionMeta(t.existing.find((f) => f.path === path)!.text, sub), id: String(sub.id) }));
    for (const l of linked) t.known.add(l.id);
    const plan = planProblem({ problem: t.problem, existing: t.existing.map((f) => f.path), known: t.known, subs });
    skipped.push(...plan.skipped.map((s) => ({ ...s, problem: t.problem })));
    // 语言不支持的提交导不进来，但它们的结果是真的：算状态时要算上
    const uncounted = plan.skipped.filter((s) => !LC_LANG[s.sub.lang]).map((s) => ({ result: resultOf(s.sub.status), date: cnParts(s.sub.timestamp).date }));
    if (plan.files.length || linked.length || uncounted.length) problems.push({ problem: t.problem, files: plan.files, linked, existing: t.existing.map((f) => f.path), subs, known: t.known, uncounted });
  }
  onProgress("", { done: totalDetails, total: totalDetails });
  return finalize({ head, progress, skipText, problems, skipped, partial, listCut, totals });
}

/**
 * 按用户的勾选算出最终要写的内容。excluded：用户不要导入的力扣提交编号，会追加进 attempts/skip.txt。
 * 不导入的提交不占序号：剩下的按时间重新编号。
 */
export function finalize(plan: Base, excluded = new Set<string>()) {
  const added: NewFile[] = [], linked: Linked[] = [], changes = new Map<number, ProgressEntry>(), perProblem = [];
  for (const p of plan.problems) {
    const keep = excluded.size ? planProblem({ problem: p.problem, existing: p.existing, known: new Set([...p.known, ...excluded]), subs: p.subs }).files : p.files;
    const before = plan.progress.problems?.[String(p.problem.id)];
    const st = nextStatus(before, [...keep, ...p.uncounted]);
    if (st) changes.set(p.problem.id, st);
    added.push(...keep);
    linked.push(...p.linked);
    if (p.files.length || p.linked.length || st) perProblem.push({ problem: p.problem, candidates: p.files, files: keep, linked: p.linked, status: st, before: before?.status || "未开始" });
  }
  const dropped = plan.problems.flatMap((p) => p.files).filter((f) => excluded.has(f.id)).map((f) => f.id);
  const writes = [...added, ...linked].map(({ path, content }) => ({ path, content }));
  if (changes.size) writes.push({ path: "progress.json", content: writeProgress(plan.progress, changes) });
  if (dropped.length) writes.push({ path: SKIP_FILE, content: writeSkip(plan.skipText, dropped) });
  return { ...plan, excluded, writes, added, linked, dropped, changes, perProblem };
}

export function commitMessage(plan: Plan) {
  const n = plan.added.length, m = plan.perProblem.filter((p) => p.files.length).length;
  const extra = [plan.linked.length && `给 ${plan.linked.length} 条手写记录补上提交编号`, plan.dropped.length && `${plan.dropped.length} 次提交记进不导入名单`].filter(Boolean);
  const lines = [`同步力扣提交记录：${n} 次提交（${m} 道题）` + (extra.length ? "，" + extra.join("，") : ""), ""];
  for (const p of plan.perProblem) {
    const bits = [];
    if (p.files.length) bits.push(`${p.files.length} 次提交`);
    if (p.linked.length) bits.push(`${p.linked.length} 条记录补上编号`);
    if (p.status) bits.push(`${p.before} → ${p.status.status}`);
    if (bits.length) lines.push(`- ${p.problem.id}. ${p.problem.name}：${bits.join("，")}`);
  }
  const t = plan.totals;
  const cut = plan.listCut ? `力扣的提交列表只读到最近 ${plan.listCut.read} 条（最早到 ${cnParts(plan.listCut.oldest).date}），` : "";
  lines.push("", `${cut}力扣上热题 100 共 ${t.hot} 次提交（${t.problems} 道题），同步前仓库里已有 ${t.known} 次` + (plan.partial ? `；这次被限流，还有 ${plan.partial.left} 次没读` : "") + "。");
  lines.push("由热题 100 网站的「从力扣同步」生成，数据来自 leetcode.cn。");
  return lines.join("\n");
}

const ids = (p: Plan) => [...p.added, ...p.linked].map((f) => `${f.path}#${f.id}`).concat(p.dropped.map((d) => `skip#${d}`)).sort().join("\n");

/**
 * 把用户确认过的内容写进仓库（一个 commit）。
 * 分支在这期间被移动过（比如在网站上改了状态）就重新读仓库再算一遍；
 * 重新算出来的和用户确认的不一样时不写，返回 { changed }，让用户重新确认。
 */
export async function commitPlan({ repo, lc, plan, cache, onProgress = () => {} }: { repo: RepoClient; lc: LeetCode; plan: Plan; cache?: Map<string, Cached>; onProgress?: Progress }) {
  let p = plan;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!p.writes.length) return { nothing: true as const, plan: p };
    try {
      onProgress("写入进度仓");
      const res = await repo.commit({ branch: p.head.branch, parent: p.head.commit, baseTree: p.head.tree, files: p.writes, message: commitMessage(p) });
      return { ...res, plan: p };
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      onProgress("仓库在这期间有了新提交，重新读取");
      const again = finalize(await buildPlan({ repo, lc, cache, onProgress }), plan.excluded);
      if (ids(again) !== ids(plan)) return { changed: true as const, plan: again };
      p = again;
    }
  }
  throw new Error("仓库一直在变，稍后再试");
}
