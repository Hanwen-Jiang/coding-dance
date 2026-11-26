// 云端运行（只能在云端跑的语言，和选了云端的 Python / JavaScript / TypeScript；Java / C++ / Go 还能调试）：网站只转手，不保存代码和结果。
//   GET：运行器集群在不在线、有几个节点、支持哪些语言（练习区用来显示「云端」的状态）；已登录时顺带返回当天云端额度
//   POST { lang, mode, code, sig?, cases: [{ input } | { stdin }], debug? }：要登录；先扣减当日额度（北京时间 0 点重置），挑节点转过去，结果原样返回
// 节点怎么挑、怎么换见 _lib/runner.ts。运行器按 GitHub 用户名限流（每分钟次数、同时一个），见 cmd/cd-runner（internal/runner）；
// 每天的额度、新账号防滥用与预算开关见 _lib/quota.ts。
import { getSession, privateJson, sameOrigin } from "../_lib/session";
import { consumeQuota, getQuotaStatus, refundQuota, type QuotaEnv } from "../_lib/quota";
import { nodeStatuses, parseNodes, runOnCluster, runnerConfigured, type RunnerEnv } from "../_lib/runner";

type Env = QuotaEnv & RunnerEnv;
const MAX_BODY = 1 << 20;

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const { session, cookie } = await getSession(request, env).catch(() => ({ session: null, cookie: null }));
  const quota = session ? await getQuotaStatus(env, session).catch(() => undefined) : undefined;
  if (!runnerConfigured(env)) return privateJson({ available: false, reason: "云端运行还没有部署", ...(quota ? { quota } : {}) }, 200, [cookie]);
  const statuses = [...(await nodeStatuses(env)).values()];
  const up = statuses.filter((s): s is NonNullable<typeof s> => !!s);
  if (!up.length) return privateJson({ available: false, reason: "云端运行器暂时都不在线", nodes: parseNodes(env.RUNNER_NODES).length, up: 0, ...(quota ? { quota } : {}) }, 200, [cookie]);
  const union = (k: "langs" | "debugLangs" | "features") => [...new Set(up.flatMap((s) => s[k] || []))];
  // features：在线节点的沙箱带上了哪些改动（_lib/runner.ts 的 LANG_FEATURES），练习区按它判断 TypeScript 能不能交给云端
  return privateJson({
    available: true, nodes: statuses.length, up: up.length, langs: union("langs"), debugLangs: union("debugLangs"), features: union("features"),
    slots: up.reduce((a, s) => a + (s.slots || 0), 0), busy: up.reduce((a, s) => a + (s.busy || 0), 0), queued: up.reduce((a, s) => a + (s.queued || 0), 0),
    ...(quota ? { quota } : {}),
  }, 200, [cookie]);
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  if (!sameOrigin(request, env)) return privateJson({ error: "不接受跨站请求" }, 403);
  if (!runnerConfigured(env)) return privateJson({ error: "云端运行还没有部署，暂时不能在云端运行" }, 503);
  const { session, cookie } = await getSession(request, env);
  if (!session) return privateJson({ error: "云端运行要先登录（右上角用 GitHub 登录）" }, 401, [cookie]);
  const body = await request.text();
  if (body.length > MAX_BODY) return privateJson({ error: "代码和用例太大了" }, 413, [cookie]);
  let hint: { lang?: string; debug?: boolean } = {};
  try { const j = JSON.parse(body) as { lang?: unknown; debug?: unknown }; hint = { lang: typeof j.lang === "string" ? j.lang : undefined, debug: !!j.debug }; } catch { /* 交给运行器报格式错误 */ }

  const q = await consumeQuota(env, session);
  if (!q.ok) return privateJson({ error: q.error, code: q.code, quota: q.quota }, q.status, [cookie]);

  const { res, tried } = await runOnCluster(env, session.l, body, hint);
  if (!res) {
    await refundQuota(env, session.l, q.quota.day);
    return privateJson({ error: `云端运行器都忙或者不在线（试了 ${tried.length} 个节点），稍后再试` }, 503, [cookie]);
  }
  if (res.status >= 500) {
    await refundQuota(env, session.l, q.quota.day);
  }
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { error: `运行器返回了看不懂的内容（${res.status}）` }; }
  if (res.ok && data && typeof data === "object" && !Array.isArray(data)) {
    return privateJson({ ...(data as Record<string, unknown>), quota: q.quota }, res.status, [cookie]);
  }
  return privateJson(data, res.status, [cookie]);
};
