// GET：读当前用户的进度（每题状态 + 有题解的语言）；PUT { id, status }：改一道题的状态并提交到用户的进度仓
import type { Status } from "../../lib/types";
import { HttpError } from "../_lib/github";
import { STATUSES, loadProgress, saveStatus } from "../_lib/progress";
import { type AuthEnv, getSession, privateJson, sameOrigin } from "../_lib/session";

const fail = (e: unknown, cookie: string | null) =>
  privateJson({ error: e instanceof Error ? e.message : String(e) }, e instanceof HttpError ? e.status : 500, [cookie]);

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  const { session: s, cookie } = await getSession(request, env);
  if (!s) return privateJson({ error: "还没登录" }, 401, [cookie]);
  try {
    return privateJson(await loadProgress(s.t, `${s.l}/${env.PROGRESS_REPO}`), 200, [cookie]);
  } catch (e) {
    return fail(e, cookie);
  }
};

export const onRequestPut = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!sameOrigin(request, env)) return privateJson({ error: "不接受跨站请求" }, 403);
  const { session: s, cookie } = await getSession(request, env);
  if (!s) return privateJson({ error: "还没登录" }, 401, [cookie]);
  const body = (await request.json().catch(() => ({}))) as { id?: number; status?: Status };
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0 || id > 9999 || !STATUSES.includes(body.status as Status)) return privateJson({ error: "参数不对" }, 400, [cookie]);
  try {
    const repo = `${s.l}/${env.PROGRESS_REPO}`;
    await saveStatus(s.t, repo, id, body.status as Status);
    return privateJson(await loadProgress(s.t, repo), 200, [cookie]);
  } catch (e) {
    return fail(e, cookie);
  }
};
