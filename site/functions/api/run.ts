// 云端运行（只能在云端跑的语言，和选了云端的 Python / JavaScript / TypeScript；Java / C++ / Go 还能调试）：网站只转手，不保存代码和结果。
//   GET：运行器集群在不在线、有几个节点、支持哪些语言（练习区用来显示「云端」的状态）
//   POST { lang, mode, code, sig?, cases: [{ input } | { stdin }], debug? }：要登录；挑一个节点转过去，结果原样返回
// 节点怎么挑、怎么换见 _lib/runner.ts。运行器按 GitHub 用户名限流（每分钟次数、同时一个），见 tools/runner/server.mjs；
// 每天的额度等「待决定 1」定了再做（ROADMAP）。
import { getSession, privateJson, sameOrigin, type AuthEnv } from "../_lib/session";
import { nodeStatuses, parseNodes, runOnCluster, runnerConfigured, type RunnerEnv } from "../_lib/runner";

type Env = AuthEnv & RunnerEnv;
const MAX_BODY = 1 << 20;

export const onRequestGet = async ({ env }: { env: Env }) => {
  if (!runnerConfigured(env)) return privateJson({ available: false, reason: "云端运行还没有部署" });
  const statuses = [...(await nodeStatuses(env)).values()];
  const up = statuses.filter((s): s is NonNullable<typeof s> => !!s);
  if (!up.length) return privateJson({ available: false, reason: "云端运行器暂时都不在线", nodes: parseNodes(env.RUNNER_NODES).length, up: 0 });
  const union = (k: "langs" | "debugLangs" | "features") => [...new Set(up.flatMap((s) => s[k] || []))];
  // features：在线节点的沙箱带上了哪些改动（_lib/runner.ts 的 LANG_FEATURES），练习区按它判断 TypeScript 能不能交给云端
  return privateJson({
    available: true, nodes: statuses.length, up: up.length, langs: union("langs"), debugLangs: union("debugLangs"), features: union("features"),
    slots: up.reduce((a, s) => a + (s.slots || 0), 0), busy: up.reduce((a, s) => a + (s.busy || 0), 0), queued: up.reduce((a, s) => a + (s.queued || 0), 0),
  });
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  if (!sameOrigin(request)) return privateJson({ error: "不接受跨站请求" }, 403);
  if (!runnerConfigured(env)) return privateJson({ error: "云端运行还没有部署，暂时不能在云端运行" }, 503);
  const { session, cookie } = await getSession(request, env);
  if (!session) return privateJson({ error: "云端运行要先登录（右上角用 GitHub 登录）" }, 401, [cookie]);
  const body = await request.text();
  if (body.length > MAX_BODY) return privateJson({ error: "代码和用例太大了" }, 413, [cookie]);
  let hint: { lang?: string; debug?: boolean } = {};
  try { const j = JSON.parse(body) as { lang?: unknown; debug?: unknown }; hint = { lang: typeof j.lang === "string" ? j.lang : undefined, debug: !!j.debug }; } catch { /* 交给运行器报格式错误 */ }
  const { res, tried } = await runOnCluster(env, session.l, body, hint);
  if (!res) return privateJson({ error: `云端运行器都忙或者不在线（试了 ${tried.length} 个节点），稍后再试` }, 503, [cookie]);
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { error: `运行器返回了看不懂的内容（${res.status}）` }; }
  return privateJson(data, res.status, [cookie]);
};
