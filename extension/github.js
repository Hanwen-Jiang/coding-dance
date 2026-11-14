// GitHub：设备授权登录（不需要 client secret），以及读写用户自己的进度仓。
// 一次同步只产生一个 commit：用 Git Data API 建 tree、建 commit、再移动分支。

/** 网站的 GitHub App（hot-100）。client id 是公开信息，每次登录跳转的网址里都带着它 */
export const CLIENT_ID = "Iv23lizmebZFGn1NTnk1";
const API = "https://api.github.com";

export class ConflictError extends Error {}

const form = (o) => new URLSearchParams(o).toString();
async function oauth(fetch, path, params) {
  const r = await fetch(`https://github.com${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form(params),
  });
  return r.json();
}

/** 设备授权第一步：拿到让用户在 github.com/login/device 输入的验证码 */
export async function startDevice(fetch) {
  const j = await oauth(fetch, "/login/device/code", { client_id: CLIENT_ID });
  if (j.error === "device_flow_disabled") throw new Error("网站的 GitHub App 还没打开 Device Flow（App 设置里的 Enable Device Flow）");
  if (j.error) throw new Error(j.error_description || j.error);
  return j; // { device_code, user_code, verification_uri, interval, expires_in }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tokenOf = (j) => ({
  access: j.access_token,
  refresh: j.refresh_token || null,
  accessExp: j.expires_in ? Date.now() + j.expires_in * 1000 : null,
  refreshExp: j.refresh_token_expires_in ? Date.now() + j.refresh_token_expires_in * 1000 : null,
});

/** 设备授权第二步：等用户在 GitHub 上点了同意 */
export async function pollDevice(fetch, dev, { signal } = {}) {
  let interval = (dev.interval || 5) * 1000;
  const end = Date.now() + (dev.expires_in || 900) * 1000;
  while (Date.now() < end) {
    await sleep(interval);
    if (signal?.aborted) throw new Error("已取消");
    const j = await oauth(fetch, "/login/oauth/access_token", { client_id: CLIENT_ID, device_code: dev.device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" });
    if (j.access_token) return tokenOf(j);
    if (j.error === "authorization_pending") continue;
    if (j.error === "slow_down") { interval += 5000; continue; }
    if (j.error === "access_denied") throw new Error("你在 GitHub 上拒绝了授权");
    if (j.error === "expired_token") break;
    throw new Error(j.error_description || j.error || "授权失败");
  }
  throw new Error("验证码过期了，请重新连接");
}

/** 令牌 8 小时过期，用 refresh token（6 个月）换新的。设备授权拿到的令牌续期也不需要 client secret */
export async function refreshToken(fetch, tok) {
  if (!tok?.refresh || (tok.refreshExp && tok.refreshExp < Date.now())) throw new Error("GitHub 授权过期了，请重新连接");
  const j = await oauth(fetch, "/login/oauth/access_token", { client_id: CLIENT_ID, grant_type: "refresh_token", refresh_token: tok.refresh });
  if (!j.access_token) throw new Error("GitHub 授权过期了，请重新连接");
  return tokenOf(j);
}

const b64ToText = (b64) => {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** 用户进度仓的读写。getToken() 每次请求前调用，负责续期 */
export function createGitHub({ fetch, getToken }) {
  async function api(method, path, body) {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${await getToken()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    const j = text ? JSON.parse(text) : null;
    if (r.status === 422 && method === "PATCH") throw new ConflictError("仓库在这期间有了新的提交");
    if (r.status === 403 || r.status === 404) throw new Error(`没有 ${path.split("/").slice(2, 4).join("/")} 的权限：确认网站的 GitHub App 装在了这个仓库上（${r.status}）`);
    if (!r.ok) throw new Error(`GitHub ${method} ${path} → ${r.status} ${j?.message || ""}`);
    return j;
  }
  return {
    user: () => api("GET", "/user"),
    /** 默认分支当前的 commit 和 tree */
    async head(repo) {
      const info = await api("GET", `/repos/${repo}`);
      const ref = await api("GET", `/repos/${repo}/git/ref/heads/${encodeURIComponent(info.default_branch)}`);
      const commit = await api("GET", `/repos/${repo}/git/commits/${ref.object.sha}`);
      return { branch: info.default_branch, commit: ref.object.sha, tree: commit.tree.sha, htmlUrl: info.html_url };
    },
    /** 整个仓库的文件列表（带每个文件的 blob sha） */
    async files(repo, tree) {
      const t = await api("GET", `/repos/${repo}/git/trees/${tree}?recursive=1`);
      if (t.truncated) throw new Error("仓库文件太多，GitHub 没有一次返回完整的列表");
      return t.tree.filter((e) => e.type === "blob").map((e) => ({ path: e.path, sha: e.sha }));
    },
    async text(repo, sha) {
      const b = await api("GET", `/repos/${repo}/git/blobs/${sha}`);
      return b.encoding === "base64" ? b64ToText(b.content) : b.content;
    },
    /** 一次提交写入多个文件。分支在这期间被移动过会抛 ConflictError，调用方重新读仓库再来 */
    async commit(repo, { branch, parent, baseTree, files, message }) {
      const tree = await api("POST", `/repos/${repo}/git/trees`, {
        base_tree: baseTree,
        tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
      });
      const c = await api("POST", `/repos/${repo}/git/commits`, { message, tree: tree.sha, parents: [parent] });
      await api("PATCH", `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: c.sha, force: false });
      return { sha: c.sha, url: c.html_url };
    },
  };
}
