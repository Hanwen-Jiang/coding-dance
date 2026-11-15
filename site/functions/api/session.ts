// 当前登录状态：是谁、进度仓建了没有、App 有没有装到进度仓上、Star 了没有。令牌本身从不返回给浏览器。
import { gh } from "../_lib/progress";
import { type AuthEnv, SESSION_COOKIE, authConfigured, getSession, privateJson, setCookie, starRepos } from "../_lib/session";

/** 用户的 App 安装里，包不包括这个仓库；返回安装 id（没装时为 null） */
async function installationFor(token: string, repo: string): Promise<{ id: number | null; covers: boolean }> {
  const r = await gh(token, "GET", "/user/installations?per_page=100");
  if (!r.ok) return { id: null, covers: false };
  const j = (await r.json()) as { installations: { id: number; account: { login: string } }[] };
  const [owner] = repo.split("/");
  const inst = j.installations.find((i) => i.account.login.toLowerCase() === owner.toLowerCase());
  if (!inst) return { id: null, covers: false };
  for (let page = 1; page <= 5; page++) {
    const rr = await gh(token, "GET", `/user/installations/${inst.id}/repositories?per_page=100&page=${page}`);
    if (!rr.ok) break;
    const jj = (await rr.json()) as { repositories: { full_name: string }[] };
    if (jj.repositories.some((x) => x.full_name.toLowerCase() === repo.toLowerCase())) return { id: inst.id, covers: true };
    if (jj.repositories.length < 100) break;
  }
  return { id: inst.id, covers: false };
}

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  const [tOwner, tName] = env.TEMPLATE_REPO.split("/");
  const base = {
    configured: authConfigured(env),
    template: env.TEMPLATE_REPO,
    repoName: env.PROGRESS_REPO,
    // GitHub 自己的「用模板新建仓库」页面
    createUrl: `https://github.com/new?template_owner=${tOwner}&template_name=${tName}&name=${env.PROGRESS_REPO}&visibility=public`,
  };
  const list = starRepos(env);
  // 没登录时也列出请用户 Star 的仓库：登录卡片上让用户先勾选，登录回来后再点
  const anon = list.map((r) => ({ repo: r, starred: false }));
  const { session: s, cookie } = await getSession(request, env);
  if (!s) return privateJson({ ...base, user: null, repo: null, starred: false, stars: anon }, 200, [cookie]);

  const repo = `${s.l}/${env.PROGRESS_REPO}`;
  const [me, rr, inst, ...starred] = await Promise.all([
    gh(s.t, "GET", "/user"),
    gh(s.t, "GET", `/repos/${repo}`),
    installationFor(s.t, repo),
    ...list.map((r) => gh(s.t, "GET", `/user/starred/${r}`)),
  ]);
  if (me.status === 401) {
    // 用户在 GitHub 上撤销了授权：清掉会话
    return privateJson({ ...base, user: null, repo: null, starred: false, stars: anon }, 200, [setCookie(SESSION_COOKIE, "", 0)]);
  }
  // 每个仓库 Star 了没有
  const stars = list.map((r, i) => ({ repo: r, starred: starred[i].status === 204 }));
  return privateJson(
    {
      ...base,
      user: { login: s.l, avatar: s.a },
      repo: {
        name: repo,
        url: `https://github.com/${repo}`,
        exists: rr.ok,
        accessible: inst.covers,
        // 已经装过 App、只是没选这个仓库：去安装设置里把它加上
        manageUrl: inst.id ? `https://github.com/settings/installations/${inst.id}` : null,
      },
      starred: stars.every((x) => x.starred),
      stars,
    },
    200,
    [cookie],
  );
};
