// POST { shas }：按 blob sha 读进度仓里的文件内容，一次最多 50 个
import { readBlobs } from "../../../lib/sync/server.ts";
import { privateJson, sameOrigin } from "../../_lib/session";
import { type SyncEnv, withUser } from "../../_lib/sync-api";

export const onRequestPost = async ({ request, env }: { request: Request; env: SyncEnv }) => {
  if (!sameOrigin(request)) return privateJson({ error: "不接受跨站请求" }, 403);
  const body = (await request.json().catch(() => ({}))) as { shas?: unknown };
  return withUser(request, env, async (api, repo) => ({ texts: await readBlobs(api, repo, body.shas) }));
};
