// 当前登录状态：是谁、进度仓建了没有、有没有授权网站读写它、Star 了没有。令牌本身从不返回给浏览器。
import { installationCovers, userInstallation } from "../_lib/install";
import { gh } from "../_lib/progress";
import { type AuthEnv, SESSION_COOKIE, authConfigured, getSession, privateJson, setCookie, starRepos } from "../_lib/session";

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  const [tOwner, tName] = env.TEMPLATE_REPO.split("/");
  const base = {
    configured: authConfigured(env),
    template: env.TEMPLATE_REPO,
    repoName: env.PROGRESS_REPO,
    // GitHub 自己的「用模板新建仓库」页面（手动开通时用）。默认建私有仓库，页面上用户选了公开就把 visibility 换掉
    createUrl: `https://github.com/new?template_owner=${tOwner}&template_name=${tName}&name=${env.PROGRESS_REPO}&visibility=private`,
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
    userInstallation(s.t, s.l),
    ...list.map((r) => gh(s.t, "GET", `/user/starred/${r}`)),
  ]);
  if (me.status === 401) {
    // 用户在 GitHub 上撤销了授权：清掉会话
    return privateJson({ ...base, user: null, repo: null, starred: false, stars: anon }, 200, [setCookie(SESSION_COOKIE, "", 0)]);
  }
  // 授权范围是「全部仓库」时，仓库存在就在范围里；只选了几个仓库时要逐个找
  const accessible = !!inst && rr.ok && (inst.selection === "all" || (await installationCovers(s.t, inst, repo)));
  // 每个仓库 Star 了没有
  const stars = list.map((r, i) => ({ repo: r, starred: starred[i].status === 204 }));
  return privateJson(
    {
      ...base,
      user: { login: s.l, avatar: s.a },
      repo: {
        name: repo,
        url: `https://github.com/${repo}`,
        // 私有仓库在授权之前网站看不到，这时 exists 也是 false
        exists: rr.ok,
        accessible,
        installed: !!inst,
        // 网站能不能直接替用户建进度仓
        canCreate: !!inst && inst.canCreate,
        // 已经授权过、只是范围里没有这个仓库：去 GitHub 的授权设置里把它加上
        manageUrl: inst ? `https://github.com/settings/installations/${inst.id}` : null,
      },
      starred: stars.every((x) => x.starred),
      stars,
    },
    200,
    [cookie],
  );
};
