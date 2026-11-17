// 测试用的假 GitHub：只实现同步用到的几个接口，仓库内容放在内存里。
// 分支被别人移动过时，PATCH refs 和真的 GitHub 一样返回 422。
import { createHash } from "node:crypto";
import type { Api } from "../server.ts";

const hash = (s: string) => createHash("sha1").update(s).digest("hex");
/** 和 git 一样的 blob sha：sha1("blob <字节数>\0" + 内容) */
const blobSha = (c: string) => createHash("sha1").update(`blob ${Buffer.byteLength(c)}\0`).update(c).digest("hex");

export function mockGitHub(initial: Record<string, string>, { owner = "me", name = "hot100-progress" } = {}) {
  const blobs = new Map<string, string>(), trees = new Map<string, Map<string, string>>(), commits = new Map<string, { tree: string; parent: string | null; message: string }>();
  const putTree = (files: Map<string, string>) => {
    const entries = [...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    for (const [, c] of entries) blobs.set(blobSha(c), c);
    const sha = hash("tree " + entries.map(([p, c]) => p + "\0" + blobSha(c)).join("\n"));
    trees.set(sha, new Map(entries));
    return sha;
  };
  const putCommit = (tree: string, parent: string | null, message: string) => {
    const sha = hash(`commit ${tree} ${parent} ${message} ${commits.size}`);
    commits.set(sha, { tree, parent, message });
    return sha;
  };
  let head = putCommit(putTree(new Map(Object.entries(initial))), null, "init");
  const repo = `${owner}/${name}`;
  const r = (status: number, json: unknown) => ({ status, json });
  let calls = 0;

  const api: Api = async (method, path, body: any) => {
    calls++;
    if (!path.startsWith(`/repos/${repo}`)) return r(404, { message: "Not Found" });
    const p = path.slice(`/repos/${repo}`.length).replace(/\?.*$/, "");
    let m: RegExpMatchArray | null;
    if (method === "GET" && p === "") return r(200, { default_branch: "main", html_url: `https://github.com/${repo}` });
    if (method === "GET" && p === "/git/ref/heads/main") return r(200, { object: { sha: head } });
    if (method === "GET" && (m = p.match(/^\/git\/commits\/(\w+)$/))) return r(200, { tree: { sha: commits.get(m[1])!.tree } });
    if (method === "GET" && (m = p.match(/^\/git\/trees\/(\w+)$/))) {
      const t = trees.get(m[1])!;
      return r(200, { truncated: false, tree: [...t.entries()].map(([path, c]) => ({ path, type: "blob", sha: blobSha(c) })) });
    }
    if (method === "GET" && (m = p.match(/^\/git\/blobs\/(\w+)$/))) return r(200, { encoding: "base64", content: Buffer.from(blobs.get(m[1])!).toString("base64") });
    if (method === "POST" && p === "/git/trees") {
      const files = new Map(trees.get(body.base_tree));
      for (const e of body.tree) files.set(e.path, e.content);
      return r(201, { sha: putTree(files) });
    }
    if (method === "POST" && p === "/git/commits") {
      const sha = putCommit(body.tree, body.parents[0], body.message);
      return r(201, { sha, html_url: `https://github.com/${repo}/commit/${sha}` });
    }
    if (method === "PATCH" && p === "/git/refs/heads/main") {
      if (!body.force && commits.get(body.sha)!.parent !== head) return r(422, { message: "Update is not a fast forward" });
      head = body.sha;
      return r(200, { object: { sha: head } });
    }
    return r(404, { message: `mock: ${method} ${p}` });
  };

  return {
    repo, api,
    calls: () => calls,
    files: () => Object.fromEntries(trees.get(commits.get(head)!.tree)!),
    log: () => { const out: string[] = []; for (let s: string | null = head; s; s = commits.get(s)!.parent) out.push(commits.get(s)!.message); return out; },
    /** 模拟别人（比如网站上改状态）往仓库推了一个 commit */
    push(path: string, content: string, message = "other") {
      const files = new Map(trees.get(commits.get(head)!.tree)!);
      files.set(path, content);
      head = putCommit(putTree(files), head, message);
    },
  };
}
