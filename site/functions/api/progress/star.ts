// POST { repos }：给用户在界面上勾选的仓库点 Star。只接受 STAR_REPOS 里配置的仓库；用户没勾的不点。
// 每个仓库各返回一个结果：点不上的（比如 GitHub 不让这个令牌给那个仓库点）带着 GitHub 的状态码，页面会给一个去 GitHub 手动点的链接。
import { gh } from "../../_lib/progress";
import { type AuthEnv, getSession, privateJson, sameOrigin, starRepos } from "../../_lib/session";

export const onRequestPost = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!sameOrigin(request, env)) return privateJson({ error: "不接受跨站请求" }, 403);
  const { session: s, cookie } = await getSession(request, env);
  if (!s) return privateJson({ error: "还没登录" }, 401, [cookie]);
  const body = (await request.json().catch(() => ({}))) as { repos?: unknown };
  const allowed = starRepos(env);
  const want = Array.isArray(body.repos) ? allowed.filter((r) => (body.repos as unknown[]).includes(r)) : [];
  if (!want.length) return privateJson({ error: "没有选仓库" }, 400, [cookie]);
  const results = await Promise.all(
    want.map(async (repo) => {
      const r = await gh(s.t, "PUT", `/user/starred/${repo}`);
      return { repo, starred: r.status === 204, status: r.status };
    }),
  );
  return privateJson({ results }, 200, [cookie]);
};
