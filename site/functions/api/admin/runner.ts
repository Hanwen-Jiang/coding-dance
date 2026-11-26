// #/admin 远端运行器集群联合监控接口：GET /api/admin/runner
// 使用 Authorization: Bearer <RUNNER_ADMIN_TOKEN || RUNNER_SECRET> 鉴权，聚合所有 cd-runner 节点的槽位、microVM 耗时与 OTel 指标。
import { clean, privateJson } from "../../_lib/session.ts";
import { clusterTelemetry, runnerConfigured, type RunnerEnv } from "../../_lib/runner.ts";

const enc = new TextEncoder();

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const ua = new Uint8Array(ha), ub = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: RunnerEnv }) => {
  const expected = clean(env.RUNNER_ADMIN_TOKEN) || clean(env.RUNNER_SECRET);
  if (!expected || !runnerConfigured(env)) {
    return privateJson({ error: "运行器集群尚未配置" }, 503);
  }
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!(await constantTimeEqual(token, expected))) {
    return privateJson({ error: "无权访问集群监控接口" }, 401);
  }
  return privateJson(await clusterTelemetry(env), 200);
};
