// 当前登录状态：是谁、进度仓建好了没有。令牌本身从不返回给浏览器。
import { gh } from "../_lib/progress";
import { type AuthEnv, SESSION_COOKIE, authConfigured, getSession, privateJson, setCookie } from "../_lib/session";

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  const base = { configured: authConfigured(env), template: env.TEMPLATE_REPO, repoName: env.PROGRESS_REPO };
  const s = await getSession(request, env);
  if (!s) return privateJson({ ...base, user: null, repo: null });
  const repo = `${s.l}/${env.PROGRESS_REPO}`;
  const r = await gh(s.t, "GET", `/repos/${repo}`);
  if (r.status === 401) {
    // 用户在 GitHub 上撤销了授权：清掉会话
    return privateJson({ ...base, user: null, repo: null }, 200, [["Set-Cookie", setCookie(SESSION_COOKIE, "", 0)]]);
  }
  return privateJson({
    ...base,
    user: { login: s.l, avatar: s.a },
    repo: { name: repo, url: `https://github.com/${repo}`, exists: r.ok },
  });
};
