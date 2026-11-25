// 云端交互式真调试器（DAP WebSocket）：GET /api/dap?lang=go|cpp|java
// 验证 GitHub 登录态与当日云端额度，按加权 Rendezvous 哈希将 WebSocket Upgrade 转发至支持 dap-ws 的 cd-runner 节点。
import { getSession, privateJson } from "../_lib/session.ts";
import { consumeQuota, refundQuota, type QuotaEnv } from "../_lib/quota.ts";
import { dapOnCluster, runnerConfigured, type RunnerEnv } from "../_lib/runner.ts";

type Env = QuotaEnv & RunnerEnv;
const DEBUG_LANGS = new Set(["java", "cpp", "go"]);

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
    return privateJson({ error: "此接口仅支持 WebSocket 升级请求（Upgrade: websocket）" }, 426);
  }
  if (!runnerConfigured(env)) {
    return privateJson({ error: "云端调试运行器尚未部署" }, 503);
  }
  const { session, cookie } = await getSession(request, env);
  if (!session) {
    return privateJson({ error: "云端调试需要先用 GitHub 登录" }, 401, [cookie]);
  }
  const lang = new URL(request.url).searchParams.get("lang") || "";
  if (!DEBUG_LANGS.has(lang)) {
    return privateJson({ error: "云端交互式 DAP 调试目前支持 java、cpp、go" }, 400, [cookie]);
  }

  const q = await consumeQuota(env, session);
  if (!q.ok) {
    return privateJson({ error: q.error, code: q.code, quota: q.quota }, q.status, [cookie]);
  }

  const { res, tried } = await dapOnCluster(request, env, session.l, lang);
  if (!res) {
    await refundQuota(env, session.l, q.quota.day);
    return privateJson({ error: `云端调试节点都忙或不在线（已尝试 ${tried.length} 个节点）` }, 503, [cookie]);
  }
  if (res.status >= 500) {
    await refundQuota(env, session.l, q.quota.day);
  }
  return res;
};
