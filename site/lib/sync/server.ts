// 同步的服务端部分：用用户自己的 GitHub 登录读写他的进度仓。只被 functions/api/sync/* 调用。
// api 由调用方注入（真实环境是带用户令牌的 fetch，测试里是假的 GitHub），这里不碰会话和 Cookie。
import { SKIP_FILE, STATUSES, parseAttemptPath, validSkip, validateAttempt } from "./core.ts";

export type Api = (method: string, path: string, body?: unknown) => Promise<{ status: number; json: any }>;

export class SyncError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

const enc = encodeURIComponent;

/** 默认分支当前的 commit、tree 和所有文件 */
export async function readRepo(api: Api, repo: string) {
  const info = await api("GET", `/repos/${repo}`);
  if (info.status === 404) throw new SyncError("找不到你的进度仓，或者网站的 GitHub App 还没装在它上面", 404);
  if (info.status >= 400) throw new SyncError(`GitHub 返回 ${info.status}`, 502);
  const branch: string = info.json.default_branch;
  const ref = await api("GET", `/repos/${repo}/git/ref/heads/${enc(branch)}`);
  if (ref.status >= 400) throw new SyncError("进度仓还是空的：先用模板建好仓库", 409);
  const commit = await api("GET", `/repos/${repo}/git/commits/${ref.json.object.sha}`);
  const tree = await api("GET", `/repos/${repo}/git/trees/${commit.json.tree.sha}?recursive=1`);
  if (tree.json.truncated) throw new SyncError("仓库文件太多，GitHub 没有一次返回完整的列表", 502);
  return {
    repo, branch, commit: ref.json.object.sha as string, tree: commit.json.tree.sha as string,
    files: (tree.json.tree as { path: string; sha: string; type: string }[]).filter((e) => e.type === "blob").map((e) => ({ path: e.path, sha: e.sha })),
  };
}

const SHA = /^[0-9a-f]{40}$/;
const dec = new TextDecoder();
const b64ToText = (b64: string) => dec.decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

/** 按 blob sha 读文件内容（一次最多 50 个，8 个并发） */
export async function readBlobs(api: Api, repo: string, shas: unknown) {
  if (!Array.isArray(shas) || shas.length > 50 || !shas.every((s) => typeof s === "string" && SHA.test(s))) throw new SyncError("参数不对");
  const out: Record<string, string> = {};
  for (let k = 0; k < shas.length; k += 8) {
    await Promise.all(shas.slice(k, k + 8).map(async (s: string) => {
      const b = await api("GET", `/repos/${repo}/git/blobs/${s}`);
      if (b.status >= 400) throw new SyncError(`读不到文件 ${s.slice(0, 7)}（${b.status}）`, 502);
      out[s] = b.json.encoding === "base64" ? b64ToText(b.json.content) : b.json.content;
    }));
  }
  return out;
}

const MAX_FILES = 600, MAX_FILE = 200_000, MAX_TOTAL = 4_000_000;

/** 同步只能写这三类文件，而且内容要符合进度仓的规则；不符合就整个拒绝，一个字都不写 */
export function validateWrites(body: unknown) {
  const b = body as { branch?: unknown; parent?: unknown; baseTree?: unknown; files?: unknown; message?: unknown };
  if (typeof b?.branch !== "string" || !b.branch || b.branch.length > 200) throw new SyncError("参数不对：branch");
  if (typeof b.parent !== "string" || !SHA.test(b.parent) || typeof b.baseTree !== "string" || !SHA.test(b.baseTree)) throw new SyncError("参数不对：parent / baseTree");
  if (typeof b.message !== "string" || !b.message || b.message.length > 20_000) throw new SyncError("参数不对：message");
  if (!Array.isArray(b.files) || !b.files.length || b.files.length > MAX_FILES) throw new SyncError(`一次最多写 ${MAX_FILES} 个文件`);
  const seen = new Set<string>();
  let total = 0;
  for (const f of b.files as { path?: unknown; content?: unknown }[]) {
    if (typeof f?.path !== "string" || typeof f.content !== "string") throw new SyncError("参数不对：files");
    if (seen.has(f.path)) throw new SyncError(`${f.path} 出现了两次`);
    seen.add(f.path);
    if (f.content.length > MAX_FILE) throw new SyncError(`${f.path} 太大了`);
    total += f.content.length;
    if (f.path === "progress.json") {
      let p: any;
      try { p = JSON.parse(f.content); } catch { throw new SyncError("progress.json 不是合法的 JSON"); }
      if (p?.version !== 1 || !p.problems || typeof p.problems !== "object" || Array.isArray(p.problems)) throw new SyncError("progress.json 的结构不对");
      for (const [k, v] of Object.entries(p.problems as Record<string, any>)) {
        if (!/^\d+$/.test(k) || !STATUSES.includes(v?.status) || (v.updatedAt != null && !/^\d{4}-\d{2}-\d{2}$/.test(v.updatedAt))) throw new SyncError(`progress.json 第 ${k} 题的内容不对`);
      }
    } else if (f.path === SKIP_FILE) {
      if (!validSkip(f.content)) throw new SyncError("attempts/skip.txt 里只能写提交编号");
    } else if (parseAttemptPath(f.path)) {
      const errs = validateAttempt(f.content);
      if (errs.length) throw new SyncError(`${f.path}：${errs[0]}`);
    } else {
      throw new SyncError(`同步不能写 ${f.path}`);
    }
  }
  if (total > MAX_TOTAL) throw new SyncError("这次要写的内容太多了，分几次同步");
  return b as { branch: string; parent: string; baseTree: string; files: { path: string; content: string }[]; message: string };
}

/** 一次提交写入：建 tree、建 commit、移动分支（不强推）。分支在这期间被移动过返回 { conflict: true } */
export async function commitWrites(api: Api, repo: string, body: unknown) {
  const b = validateWrites(body);
  const tree = await api("POST", `/repos/${repo}/git/trees`, { base_tree: b.baseTree, tree: b.files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })) });
  if (tree.status >= 400) throw new SyncError(`GitHub 建 tree 失败（${tree.status}）`, 502);
  const c = await api("POST", `/repos/${repo}/git/commits`, { message: b.message, tree: tree.json.sha, parents: [b.parent] });
  if (c.status >= 400) throw new SyncError(`GitHub 建 commit 失败（${c.status}）`, 502);
  const ref = await api("PATCH", `/repos/${repo}/git/refs/heads/${enc(b.branch)}`, { sha: c.json.sha, force: false });
  if (ref.status === 422 || ref.status === 409) return { conflict: true as const };
  if (ref.status >= 400) throw new SyncError(`GitHub 更新分支失败（${ref.status}）`, 502);
  return { sha: c.json.sha as string, url: c.json.html_url as string };
}
