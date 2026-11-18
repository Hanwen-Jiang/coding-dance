// 云端运行（Java / C++ / Go 的练习、调试）：网站只转手，不保存代码和结果。
//   GET：运行器在不在线、支持哪些语言（练习区用来显示「云端」的状态）
//   POST { lang, mode, code, sig?, cases: [{ input } | { stdin }], debug? }：要登录；转给运行器，结果原样返回
// 运行器按 GitHub 用户名限流（每分钟次数、同时一个），见 tools/runner/server.mjs；每天的额度等「待决定 1」定了再做（ROADMAP）。
import { getSession, privateJson, sameOrigin, type AuthEnv } from "../_lib/session";
import { callRunner, runnerConfigured, type RunnerEnv } from "../_lib/runner";

type Env = AuthEnv & RunnerEnv;
const MAX_BODY = 1 << 20;

export const onRequestGet = async ({ env }: { env: Env }) => {
  if (!runnerConfigured(env)) return privateJson({ available: false, reason: "云端运行还没有部署" });
  try {
    const res = await callRunner(env, "GET", "/v1/status", "");
    if (!res.ok) return privateJson({ available: false, reason: `运行器没有响应（${res.status}）` });
    const s = (await res.json()) as { langs?: string[]; debugLangs?: string[]; busy?: number; queued?: number };
    return privateJson({ available: true, langs: s.langs, debugLangs: s.debugLangs, busy: s.busy, queued: s.queued });
  } catch {
    return privateJson({ available: false, reason: "连不上运行器" });
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  if (!sameOrigin(request)) return privateJson({ error: "不接受跨站请求" }, 403);
  if (!runnerConfigured(env)) return privateJson({ error: "云端运行还没有部署，Java / C++ / Go 暂时不能运行" }, 503);
  const { session, cookie } = await getSession(request, env);
  if (!session) return privateJson({ error: "云端运行要先登录（右上角用 GitHub 登录）" }, 401, [cookie]);
  const body = await request.text();
  if (body.length > MAX_BODY) return privateJson({ error: "代码和用例太大了" }, 413, [cookie]);
  try {
    const res = await callRunner(env, "POST", "/v1/run", session.l, body);
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { error: `运行器返回了看不懂的内容（${res.status}）` }; }
    return privateJson(data, res.ok ? 200 : res.status === 401 ? 502 : res.status, [cookie]);
  } catch {
    return privateJson({ error: "连不上云端运行器，稍后再试" }, 502, [cookie]);
  }
};
