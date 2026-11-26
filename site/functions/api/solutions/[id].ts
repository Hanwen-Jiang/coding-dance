// 当前用户进度仓里某道题的题解和尝试记录
import { HttpError } from "../../_lib/github";
import { loadMine } from "../../_lib/progress";
import { type AuthEnv, getSession, privateJson } from "../../_lib/session";

export const onRequestGet = async ({ request, env, params }: { request: Request; env: AuthEnv; params: { id: string } }) => {
  const { session: s, cookie } = await getSession(request, env);
  if (!s) return privateJson({ error: "还没登录" }, 401, [cookie]);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return privateJson({ error: "题号不对" }, 400, [cookie]);
  try {
    return privateJson(await loadMine(s.t, `${s.l}/${env.PROGRESS_REPO}`, id), 200, [cookie]);
  } catch (e) {
    return privateJson({ error: e instanceof Error ? e.message : String(e) }, e instanceof HttpError ? e.status : 500, [cookie]);
  }
};
