// 测试用的假 GitHub：只实现扩展用到的几个接口，仓库内容放在内存里。
// 分支被别人移动过时，PATCH refs 和真的 GitHub 一样返回 422。
import { createHash } from "node:crypto";

const hash = (s) => createHash("sha1").update(s).digest("hex");

export function mockGitHub(initial /* { path: content } */, { owner = "me", name = "hot100-progress" } = {}) {
  const blobs = new Map(), trees = new Map(), commits = new Map();
  const putTree = (files) => {
    const entries = [...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    for (const [, c] of entries) blobs.set(hash("blob " + c), c);
    const sha = hash("tree " + entries.map(([p, c]) => p + "\0" + hash("blob " + c)).join("\n"));
    trees.set(sha, new Map(entries));
    return sha;
  };
  const putCommit = (tree, parent, message) => {
    const sha = hash(`commit ${tree} ${parent} ${message} ${commits.size}`);
    commits.set(sha, { tree, parent, message });
    return sha;
  };
  let head = putCommit(putTree(new Map(Object.entries(initial))), null, "init");
  const repo = `${owner}/${name}`;
  const json = (status, body) => ({ status, ok: status < 400, text: async () => JSON.stringify(body) });

  async function fetch(url, opts = {}) {
    const u = new URL(url), method = opts.method || "GET", body = opts.body ? JSON.parse(opts.body) : null;
    const p = u.pathname.replace(`/repos/${repo}`, "");
    if (!u.pathname.startsWith(`/repos/${repo}`)) return u.pathname === "/user" ? json(200, { login: owner }) : json(404, { message: "Not Found" });
    if (method === "GET" && p === "") return json(200, { default_branch: "main", html_url: `https://github.com/${repo}` });
    if (method === "GET" && p === "/git/ref/heads/main") return json(200, { object: { sha: head } });
    let m;
    if (method === "GET" && (m = p.match(/^\/git\/commits\/(\w+)$/))) return json(200, { tree: { sha: commits.get(m[1]).tree } });
    if (method === "GET" && (m = p.match(/^\/git\/trees\/(\w+)$/))) {
      const t = trees.get(m[1]);
      return json(200, { truncated: false, tree: [...t.entries()].map(([path, c]) => ({ path, type: "blob", sha: hash("blob " + c) })) });
    }
    if (method === "GET" && (m = p.match(/^\/git\/blobs\/(\w+)$/))) return json(200, { encoding: "base64", content: Buffer.from(blobs.get(m[1])).toString("base64") });
    if (method === "POST" && p === "/git/trees") {
      const files = new Map(trees.get(body.base_tree));
      for (const e of body.tree) files.set(e.path, e.content);
      return json(201, { sha: putTree(files) });
    }
    if (method === "POST" && p === "/git/commits") {
      const sha = putCommit(body.tree, body.parents[0], body.message);
      return json(201, { sha, html_url: `https://github.com/${repo}/commit/${sha}` });
    }
    if (method === "PATCH" && p === "/git/refs/heads/main") {
      if (!body.force && commits.get(body.sha).parent !== head) return json(422, { message: "Update is not a fast forward" });
      head = body.sha;
      return json(200, { object: { sha: head } });
    }
    return json(404, { message: `mock: ${method} ${p}` });
  }

  return {
    repo, fetch,
    files: () => Object.fromEntries(trees.get(commits.get(head).tree)),
    log: () => { const out = []; for (let s = head; s; s = commits.get(s).parent) out.push(commits.get(s).message); return out; },
    /** 模拟别人（比如网站）往仓库推了一个 commit */
    push(path, content, message = "other") {
      const files = new Map(trees.get(commits.get(head).tree));
      files.set(path, content);
      head = putCommit(putTree(files), head, message);
    },
  };
}
