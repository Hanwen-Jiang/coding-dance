// GET：当前用户进度仓默认分支的 commit、tree 和文件列表（同步页用来判断哪些已经导入过）
import { readRepo } from "../../../lib/sync/server.ts";
import { type SyncEnv, withUser } from "../../_lib/sync-api";

export const onRequestGet = ({ request, env }: { request: Request; env: SyncEnv }) => withUser(request, env, (api, repo) => readRepo(api, repo));
