// 练习区写进度仓的服务端部分：用用户自己的 GitHub 登录读写他的进度仓。只被 functions/api/progress/practice.ts 调用。
// api 由调用方注入（真实环境是带用户令牌的 fetch，测试里是假的 GitHub），这里不碰会话和 Cookie。
// 写哪些文件、写什么内容由 record.ts 按进度仓的规则生成；内容和仓库里一样的文件不写（草稿没改就不产生 commit）；
// 分支在这期间被别处移动过就重新读一遍再写，最多三次。
import type { Problem, ProgressFile } from "../sync/core.ts";
import { type Api, SyncError, commitFiles, readBlobs, readRepo } from "../sync/server.ts";
import { existingSolutions, findDraft, gitBlobSha, planSave, validateSave, type PracticeMode } from "./record.ts";

export interface SaveResult {
  /** 真的写了（有内容和仓库里不一样） */
  saved: boolean;
  commit?: string;
  /** 这次写进去的文件 */
  files: string[];
  attempt?: string;
  solution?: string;
  draft?: string;
  status?: string;
}

export async function savePractice(api: Api, repo: string, body: unknown, now = () => Date.now()): Promise<SaveResult> {
  const s = validateSave(body);
  for (let attempt = 0; attempt < 3; attempt++) {
    const head = await readRepo(api, repo);
    const sha = new Map(head.files.map((f) => [f.path, f.sha]));
    if (!sha.has("hot100.json")) throw new SyncError("进度仓里没有 hot100.json：确认这个仓库是用模板建的", 409);
    const want = ["hot100.json", "progress.json"].filter((p) => sha.has(p));
    // 全部通过时要和已有的题解比一比（同一份代码不再存）；最多读 40 份
    const mine = s.kind === "run" && s.result === "通过" ? existingSolutions(head.files.map((f) => f.path), s.id, s.lang).slice(0, 40) : [];
    const texts = await readBlobs(api, repo, [...new Set([...want, ...mine].map((p) => sha.get(p)!))]);
    const read = (p: string) => (sha.has(p) ? texts[sha.get(p)!] : null);
    let hot: Problem[], progress: ProgressFile | null;
    try {
      hot = JSON.parse(read("hot100.json")!).problems;
      progress = read("progress.json") ? JSON.parse(read("progress.json")!) : null;
    } catch {
      throw new SyncError("进度仓里的 hot100.json 或 progress.json 不是合法的 JSON", 422);
    }
    const problem = Array.isArray(hot) ? hot.find((p) => p.id === s.id) : undefined;
    if (!problem) throw new SyncError("这道题不在你进度仓的 hot100.json 里", 404);
    const solutions = Object.fromEntries(mine.map((p) => [p, texts[sha.get(p)!]]));
    const plan = planSave(s, { problem, paths: head.files.map((f) => f.path), progress, now: now(), solutions });
    const files = [];
    for (const f of plan.files) if (sha.get(f.path) !== (await gitBlobSha(f.content))) files.push(f);
    const meta = { attempt: plan.attempt, solution: plan.solution, status: plan.status, draft: s.kind === "draft" ? plan.files[0].path : undefined };
    if (!files.length) return { saved: false, files: [], ...meta };
    const res = await commitFiles(api, repo, { branch: head.branch, parent: head.commit, baseTree: head.tree }, files, plan.message);
    if (!("conflict" in res)) return { saved: true, commit: res.sha, files: files.map((f) => f.path), ...meta };
  }
  throw new SyncError("进度仓刚被别的地方改过，稍后再存一次", 409);
}

/** 这道题这种语言（和模式）的草稿；没有返回 { code: null } */
export async function loadPracticeDraft(api: Api, repo: string, q: URLSearchParams) {
  const id = Number(q.get("id")), lang = q.get("lang") || "", mode = q.get("mode");
  if (!Number.isInteger(id) || id < 1 || (mode !== "leetcode" && mode !== "acm")) throw new SyncError("参数不对");
  const head = await readRepo(api, repo);
  const path = findDraft(head.files.map((f) => f.path), id, lang, mode as PracticeMode);
  if (!path) return { code: null };
  const sha = head.files.find((f) => f.path === path)!.sha;
  const texts = await readBlobs(api, repo, [sha]);
  return { code: texts[sha], path };
}
