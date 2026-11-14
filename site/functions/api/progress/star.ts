// POST：给模板仓点个 Star。只有用户在界面上开着「顺手 Star」开关时，前端才会调用。
import { gh } from "../../_lib/progress";
import { type AuthEnv, getSession, privateJson, sameOrigin } from "../../_lib/session";

export const onRequestPost = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!sameOrigin(request)) return privateJson({ error: "不接受跨站请求" }, 403);
  const { session: s, cookie } = await getSession(request, env);
  if (!s) return privateJson({ error: "还没登录" }, 401, [cookie]);
  const r = await gh(s.t, "PUT", `/user/starred/${env.TEMPLATE_REPO}`);
  return privateJson({ starred: r.status === 204 }, r.status === 204 ? 200 : 502, [cookie]);
};
