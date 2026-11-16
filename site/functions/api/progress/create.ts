// POST { private }：用模板在用户自己的账号下建进度仓（不用跳到 GitHub）。
// 要求用户已经授权，并且授权里带「建仓库」的权限；建好的仓库 GitHub 会自动放进授权范围。
import { HttpError } from "../../_lib/github";
import { createFromTemplate } from "../../_lib/install";
import { type AuthEnv, getSession, privateJson, sameOrigin } from "../../_lib/session";

export const onRequestPost = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!sameOrigin(request)) return privateJson({ error: "不接受跨站请求" }, 403);
  const { session: s, cookie } = await getSession(request, env);
  if (!s) return privateJson({ error: "还没登录" }, 401, [cookie]);
  const body = (await request.json().catch(() => ({}))) as { private?: unknown };
  try {
    await createFromTemplate(s.t, env.TEMPLATE_REPO, s.l, env.PROGRESS_REPO, body.private !== false);
    return privateJson({ created: true }, 200, [cookie]);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    // code：页面按它决定接下来给用户看什么（已经有同名仓库 / 这次授权不能建仓库）
    return privateJson({ error: e instanceof Error ? e.message : String(e), code: status === 409 ? "exists" : status === 403 ? "forbidden" : "failed" }, status, [cookie]);
  }
};
