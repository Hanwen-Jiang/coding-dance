// 同步的流程：先读进度仓（唯一的数据源）和力扣，算出可以写什么（不写任何东西）；
// 用户勾选、确认后，一次提交写进仓库。
import { LC_LANG, SKIP_FILE, addSubmissionMeta, matchExisting, nextStatus, parseAttemptPath, parseSkip, planProblem, readAttempt, writeProgress, writeSkip } from "./core.js";
import { ConflictError } from "./github.js";
import { isRateLimited } from "./leetcode.js";

/**
 * 读仓库和力扣，列出每道题可以新增的记录。
 * 判断「导入过没有」永远以仓库为准：写了 submission 编号的记录直接认；没写编号的（手写的）按代码去和力扣提交对，
 * 对上了就只给它补编号；attempts/skip.txt 里的编号是用户说过不要导入的。
 * shaCache：blob sha → 记录内容，只是仓库内容的缓存（内容变了 sha 就变）。
 */
export async function buildPlan({ gh, lc, repo, shaCache = new Map(), onProgress = () => {}, only = null }) {
  onProgress("读取进度仓");
  const head = await gh.head(repo);
  const files = await gh.files(repo, head.tree);
  const sha = new Map(files.map((f) => [f.path, f.sha]));
  if (!sha.has("hot100.json")) throw new Error("进度仓里没有 hot100.json：确认这个仓库是用模板建的");
  const hot = JSON.parse(await gh.text(repo, sha.get("hot100.json"))).problems;
  const progress = sha.has("progress.json") ? JSON.parse(await gh.text(repo, sha.get("progress.json"))) : { version: 1, problems: {} };
  const skipText = sha.has(SKIP_FILE) ? await gh.text(repo, sha.get(SKIP_FILE)) : null;
  const skipIds = parseSkip(skipText);
  const attempts = new Map();
  for (const f of files) {
    const a = parseAttemptPath(f.path);
    if (a) (attempts.get(a.id) || attempts.set(a.id, []).get(a.id)).push(f);
  }

  let targets, lastAt = new Map();
  if (only) targets = hot.filter((h) => only.has(h.id)); // 只同步指定的题（测试用）
  else {
    onProgress("读取力扣的做题记录");
    try {
      const done = (await lc.progress()).filter((q) => q.numSubmitted > 0);
      lastAt = new Map(done.map((q) => [q.titleSlug, Date.parse(q.lastSubmittedAt)]));
      // 最近提交过的题先读：力扣限流、只能读一部分时，先拿到的是最近做的题
      targets = hot.filter((h) => lastAt.has(h.slug)).sort((a, b) => lastAt.get(b.slug) - lastAt.get(a.slug));
    } catch (e) {
      if (!isRateLimited(e)) throw e;
      // 「做过的题」接口被限流了：不等它，逐题查提交列表（没提交过的题会返回空列表）。
      // 不知道哪些题最近做过，就先读仓库里已经有尝试记录的题
      onProgress("力扣的「做过的题」接口限流了，改成逐题查询");
      targets = [...hot.filter((h) => attempts.has(h.id)), ...hot.filter((h) => !attempts.has(h.id))];
    }
  }

  // 先把要用到的已有记录并行读进来（每次 8 个）
  const need = targets.flatMap((p) => attempts.get(p.id) || []).filter((f) => !shaCache.has(f.sha));
  for (let k = 0; k < need.length; k += 8) {
    onProgress(`读取进度仓里已有的尝试记录（${Math.min(k + 8, need.length)} / ${need.length}）`);
    await Promise.all(need.slice(k, k + 8).map(async (f) => { const text = await gh.text(repo, f.sha); shaCache.set(f.sha, { text, ...readAttempt(text) }); }));
  }

  const problems = [], skipped = [];
  let partial = null;
  for (const [i, problem] of targets.entries()) {
    onProgress(`读取第 ${problem.id} 题的提交（${i + 1} / ${targets.length}）`);
    const existing = (attempts.get(problem.id) || []).map((f) => ({ ...f, ...parseAttemptPath(f.path), ...shaCache.get(f.sha) }));
    const known = new Set([...existing.map((f) => f.submission).filter(Boolean), ...skipIds]);
    // 仓库里已经有这道题最后一次提交（或更晚）的记录：力扣上没有新的，不用去查
    const newestKnown = Math.max(0, ...existing.map((f) => Date.parse(f.submittedAt) || 0));
    if (lastAt.get(problem.slug) && newestKnown && lastAt.get(problem.slug) <= newestKnown + 1000) continue;
    // 先把这道题要用的力扣数据全部读完（代码只读仓库里还没有的提交）；
    // 中途被限流就停在这里：前面读完的题照常写，这道题和后面的下次同步再读
    const subs = [];
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
    const linked = [...pairs].map(([path, sub]) => ({ path, content: addSubmissionMeta(existing.find((f) => f.path === path).text, sub), id: String(sub.id) }));
    for (const l of linked) known.add(l.id);
    const plan = planProblem({ problem, existing: existing.map((f) => f.path), known, subs });
    skipped.push(...plan.skipped.map((s) => ({ ...s, problem })));
    if (plan.files.length || linked.length) problems.push({ problem, files: plan.files, linked, existing: existing.map((f) => f.path), subs, known });
  }
  return finalize({ repo, head, progress, skipText, problems, skipped, partial });
}

/**
 * 按用户的勾选算出最终要写的内容。excluded：用户不要导入的力扣提交编号，会追加进 attempts/skip.txt。
 * 不导入的提交不占序号：剩下的按时间重新编号。
 */
export function finalize(plan, excluded = new Set()) {
  const added = [], linked = [], changes = new Map(), perProblem = [];
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

export function commitMessage(plan) {
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
  lines.push("", "由 Hot 100 同步扩展在浏览器里生成，数据直接来自 leetcode.cn。");
  return lines.join("\n");
}

const ids = (p) => [...p.added, ...p.linked].map((f) => `${f.path}#${f.id}`).concat(p.dropped.map((d) => `skip#${d}`)).sort().join("\n");

/**
 * 把用户确认过的内容写进仓库（一个 commit）。
 * 分支在这期间被移动过（比如在网站上改了状态）就重新读仓库再算一遍；
 * 重新算出来的和用户确认的不一样时不写，返回 { changed }，让用户重新确认。
 */
export async function commitPlan({ gh, lc, plan, shaCache, onProgress = () => {} }) {
  let p = plan;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!p.writes.length) return { nothing: true, plan: p };
    try {
      onProgress("写入进度仓");
      const res = await gh.commit(p.repo, { branch: p.head.branch, parent: p.head.commit, baseTree: p.head.tree, files: p.writes, message: commitMessage(p) });
      return { ...res, plan: p };
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      onProgress("仓库在这期间有了新提交，重新读取");
      const again = finalize(await buildPlan({ gh, lc, repo: p.repo, shaCache, onProgress }), plan.excluded);
      if (ids(again) !== ids(plan)) return { changed: true, plan: again };
      p = again;
    }
  }
  throw new Error("仓库一直在变，稍后再试");
}
