// POST { branch, parent, baseTree, files, message }：把用户确认过的同步内容作为一个 commit 写进他的进度仓。
// 只能写 progress.json、attempts/skip.txt 和符合规则的尝试记录（lib/sync/server.ts 里检查）；
// 分支在这期间被移动过返回 409，页面重新读仓库再让用户确认。
import { commitWrites } from "../../../lib/sync/server.ts";
import { privateJson, sameOrigin } from "../../_lib/session";
import { type SyncEnv, withUser } from "../../_lib/sync-api";

export const onRequestPost = async ({ request, env }: { request: Request; env: SyncEnv }) => {
  if (!sameOrigin(request, env)) return privateJson({ error: "不接受跨站请求" }, 403);
  const body = await request.json().catch(() => null);
  const res = await withUser(request, env, (api, repo) => commitWrites(api, repo, body));
  if (res.status === 200) {
    const j = (await res.clone().json()) as { conflict?: boolean };
    if (j.conflict) return new Response(res.body, { status: 409, headers: res.headers });
  }
  return res;
};
