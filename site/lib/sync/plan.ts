// 同步的流程：先读进度仓（唯一的数据源）和力扣，算出可以写什么（不写任何东西）；
// 用户勾选、确认后，一次提交写进仓库。
import {
  LC_LANG, SKIP_FILE, addSubmissionMeta, matchExisting, nextStatus, parseAttemptPath, parseSkip, planProblem, readAttempt, writeProgress, writeSkip,
  type NewFile, type Problem, type ProgressEntry, type ProgressFile, type Skipped, type SubWithDetail,
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
interface ProblemPlan { problem: Problem; files: NewFile[]; linked: Linked[]; existing: string[]; subs: SubWithDetail[]; known: Set<string> }
interface Base {
  head: Awaited<ReturnType<RepoClient["head"]>>;
  progress: ProgressFile; skipText: string | null;
  problems: ProblemPlan[]; skipped: (Skipped & { problem: Problem })[];
  partial: { done: number; total: number; next: Problem } | null;
}
export type Plan = ReturnType<typeof finalize>;
type Cached = { text: string } & ReturnType<typeof readAttempt>;

/**
 * 读仓库和力扣，列出每道题可以新增的记录。
 * 判断「导入过没有」永远以仓库为准：写了 submission 编号的记录直接认；没写编号的（手写的）按代码去和力扣提交对，
 * 对上了就只给它补编号；attempts/skip.txt 里的编号是用户说过不要导入的。
 * cache：blob sha → 记录内容，只是仓库内容的缓存（内容变了 sha 就变）。
 */
export async function buildPlan({ repo, lc, cache = new Map<string, Cached>(), onProgress = (_m: string) => {}, only = null as Set<number> | null }: {
  repo: RepoClient; lc: LeetCode; cache?: Map<string, Cached>; onProgress?: (m: string) => void; only?: Set<number> | null;
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

  let targets: Problem[], lastAt = new Map<string, number>();
  if (only) targets = hot.filter((h) => only.has(h.id)); // 只同步指定的题（测试用）
  else {
    onProgress("读取力扣的做题记录");
    try {
      const done = (await lc.progress()).filter((q) => q.numSubmitted > 0);
      lastAt = new Map(done.map((q) => [q.titleSlug, Date.parse(q.lastSubmittedAt || "")]));
      // 最近提交过的题先读：力扣限流、只能读一部分时，先拿到的是最近做的题
      targets = hot.filter((h) => lastAt.has(h.slug)).sort((a, b) => (lastAt.get(b.slug) || 0) - (lastAt.get(a.slug) || 0));
    } catch (e) {
      if (!isRateLimited(e)) throw e;
      // 「做过的题」接口被限流了：不等它，逐题查提交列表（没提交过的题会返回空列表）。不知道哪些题最近做过，就先读仓库里已经有尝试记录的题
      onProgress("力扣的「做过的题」接口限流了，改成逐题查询");
      targets = [...hot.filter((h) => attempts.has(h.id)), ...hot.filter((h) => !attempts.has(h.id))];
    }
  }

  // 先把要用到的已有记录读进来（每次 40 个）
  const need = targets.flatMap((p) => attempts.get(p.id) || []).filter((f) => !cache.has(f.sha));
  for (let k = 0; k < need.length; k += 40) {
    onProgress(`读取进度仓里已有的尝试记录（${Math.min(k + 40, need.length)} / ${need.length}）`);
    const got = await repo.texts(need.slice(k, k + 40).map((f) => f.sha));
    for (const [s, text] of Object.entries(got)) cache.set(s, { text, ...readAttempt(text) });
  }

  const problems: ProblemPlan[] = [], skipped: Base["skipped"] = [];
  let partial: Base["partial"] = null;
  for (const [i, problem] of targets.entries()) {
    onProgress(`读取第 ${problem.id} 题的提交（${i + 1} / ${targets.length}）`);
    const existing = (attempts.get(problem.id) || []).map((f) => ({ ...f, ...parseAttemptPath(f.path)!, ...cache.get(f.sha)! }));
    const known = new Set([...existing.map((f) => f.submission).filter((x): x is string => !!x), ...skipIds]);
    // 仓库里已经有这道题最后一次提交（或更晚）的记录：力扣上没有新的，不用去查
    const newestKnown = Math.max(0, ...existing.map((f) => Date.parse(f.submittedAt || "") || 0));
    const lastSub = lastAt.get(problem.slug);
    if (lastSub && newestKnown && lastSub <= newestKnown + 1000) continue;
    // 先把这道题要用的力扣数据全部读完（代码只读仓库里还没有的提交）；中途被限流就停在这里：前面读完的题照常写，这道题和后面的下次同步再读
    const subs: SubWithDetail[] = [];
    try {
      for (const s of (await lc.submissions(problem.slug)).filter((x) => !known.has(String(x.id)))) {
        const want = LC_LANG[s.lang] && (!s.isPending || s.isPending === "Not Pending");
        subs.push({ sub: s, detail: want ? await lc.detail(s.id) : { lang: s.lang } });
      }
    } catch (e) {
      if (!isRateLimited(e)) throw e;
      partial = { done: i, total: targets.length, next: problem };
      break;
    }
    // 手写的记录先和力扣提交对上，对上的只补编号
    const pairs = matchExisting(existing.filter((f) => !f.submission), subs);
    const linked = [...pairs].map(([path, sub]) => ({ path, content: addSubmissionMeta(existing.find((f) => f.path === path)!.text, sub), id: String(sub.id) }));
    for (const l of linked) known.add(l.id);
    const plan = planProblem({ problem, existing: existing.map((f) => f.path), known, subs });
    skipped.push(...plan.skipped.map((s) => ({ ...s, problem })));
    if (plan.files.length || linked.length) problems.push({ problem, files: plan.files, linked, existing: existing.map((f) => f.path), subs, known });
  }
  return finalize({ head, progress, skipText, problems, skipped, partial });
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
    const st = nextStatus(before, keep);
    if (st) changes.set(p.problem.id, st);
    added.push(...keep);
    linked.push(...p.linked);
    perProblem.push({ problem: p.problem, candidates: p.files, files: keep, linked: p.linked, status: st, before: before?.status || "未开始" });
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
  lines.push("", "由热题 100 网站的「从力扣同步」生成，数据来自 leetcode.cn。");
  return lines.join("\n");
}

const ids = (p: Plan) => [...p.added, ...p.linked].map((f) => `${f.path}#${f.id}`).concat(p.dropped.map((d) => `skip#${d}`)).sort().join("\n");

/**
 * 把用户确认过的内容写进仓库（一个 commit）。
 * 分支在这期间被移动过（比如在网站上改了状态）就重新读仓库再算一遍；
 * 重新算出来的和用户确认的不一样时不写，返回 { changed }，让用户重新确认。
 */
export async function commitPlan({ repo, lc, plan, cache, onProgress = (_m: string) => {} }: { repo: RepoClient; lc: LeetCode; plan: Plan; cache?: Map<string, Cached>; onProgress?: (m: string) => void }) {
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
