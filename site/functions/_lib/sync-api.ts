// 从力扣同步：服务端用当前用户自己的 GitHub 登录读写他的进度仓（<用户>/hot100-progress）。
// 只代办，不保存任何数据；要写的内容在 lib/sync/server.ts 里逐个检查过才会交给 GitHub。
import type { Api } from "../../lib/sync/server.ts";
import { SyncError } from "../../lib/sync/server.ts";
import { type AuthEnv, getSession, privateJson } from "./session";

export interface SyncEnv extends AuthEnv {
  /** 只在本地测试时设置，指向一个假的 GitHub；线上不设，就是 api.github.com */
  SYNC_GITHUB_API?: string;
}

export function userApi(env: SyncEnv, token: string): Api {
  const base = (env.SYNC_GITHUB_API || "https://api.github.com").replace(/\/$/, "");
  return async (method, path, body) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "lc-hot100-site",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* GitHub 偶尔返回非 JSON 的错误页 */ }
    return { status: r.status, json };
  };
}

/** 包一层：要求已登录，出错时返回中文错误；会话续期产生的 Cookie 一起带回去 */
export async function withUser(request: Request, env: SyncEnv, fn: (api: Api, repo: string) => Promise<unknown>) {
  const { session: s, cookie } = await getSession(request, env);
  if (!s) return privateJson({ error: "还没登录" }, 401, [cookie]);
  try {
    return privateJson(await fn(userApi(env, s.t), `${s.l}/${env.PROGRESS_REPO}`), 200, [cookie]);
  } catch (e) {
    return privateJson({ error: e instanceof Error ? e.message : String(e) }, e instanceof SyncError ? e.status : 500, [cookie]);
  }
}
