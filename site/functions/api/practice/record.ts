// POST：练习里「测试全部」的结果写进当前用户自己的进度仓（尝试记录；全部通过时另存题解；状态只升不降）。
// 网页只传代码和运行结果，写哪些文件、写什么由 lib/practice/record.ts 按进度仓的规则决定。
import { recordRun, validateRecordInput } from "../../../lib/practice/record.ts";
import { privateJson, sameOrigin } from "../../_lib/session";
import { type SyncEnv, withUser } from "../../_lib/sync-api";

export const onRequestPost = async ({ request, env }: { request: Request; env: SyncEnv }) => {
  if (!sameOrigin(request)) return privateJson({ error: "不接受跨站请求" }, 403);
  const body = await request.json().catch(() => null);
  return withUser(request, env, (api, repo) => recordRun({ api, repo, input: validateRecordInput(body) }));
};
