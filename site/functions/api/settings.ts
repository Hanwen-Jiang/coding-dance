// PUT { langs }：把用户的常用语言写进他自己进度仓的 settings.json（第一个是默认语言）
import { HttpError } from "../_lib/github";
import { cleanLangs, saveSettings } from "../_lib/progress";
import { type AuthEnv, getSession, privateJson, sameOrigin } from "../_lib/session";

export const onRequestPut = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!sameOrigin(request, env)) return privateJson({ error: "不接受跨站请求" }, 403);
  const { session: s, cookie } = await getSession(request, env);
  if (!s) return privateJson({ error: "还没登录" }, 401, [cookie]);
  const body = (await request.json().catch(() => ({}))) as { langs?: unknown };
  const langs = cleanLangs(body.langs);
  if (!langs) return privateJson({ error: "至少选一种语言" }, 400, [cookie]);
  try {
    return privateJson({ settings: await saveSettings(s.t, `${s.l}/${env.PROGRESS_REPO}`, langs) }, 200, [cookie]);
  } catch (e) {
    return privateJson({ error: e instanceof Error ? e.message : String(e) }, e instanceof HttpError ? e.status : 500, [cookie]);
  }
};
