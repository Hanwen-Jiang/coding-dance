// 网站练习区和用户自己的进度仓（用他自己的 GitHub 登录读写，网站不另存任何东西）：
//   POST { kind: "draft", id, lang, mode, code }：存草稿（Ctrl+S、自动保存）；
//   POST { kind: "run", id, lang, mode, code, result, passed, total, duration, notes, scope?, manual? }：记一条尝试记录
//        （全量测试跑完自动记；「存为尝试记录」手动记，scope 写明是哪组用例，只有全量才能记「通过」），
//        全量通过再存成题解，状态只升不降；
//   POST { kind: "solution", id, lang, mode, code, label }：「存为我的题解」，没全量通过的写法名标上 label（未通过 / 未验证）；
//   GET ?id=&lang=&mode=：读这道题这种语言的草稿（换台电脑接着写）。
// 写哪些文件、写什么内容都由 lib/practice/record.ts 按进度仓的规则生成，页面只传代码和测试结果（lib/practice/server.ts）。
import { loadPracticeDraft, savePractice } from "../../../lib/practice/server.ts";
import { privateJson, sameOrigin } from "../../_lib/session";
import { type SyncEnv, withUser } from "../../_lib/sync-api";

export const onRequestPost = async ({ request, env }: { request: Request; env: SyncEnv }) => {
  if (!sameOrigin(request, env)) return privateJson({ error: "不接受跨站请求" }, 403);
  const body = await request.json().catch(() => null);
  return withUser(request, env, (api, repo) => savePractice(api, repo, body));
};

export const onRequestGet = async ({ request, env }: { request: Request; env: SyncEnv }) =>
  withUser(request, env, (api, repo) => loadPracticeDraft(api, repo, new URL(request.url).searchParams));
