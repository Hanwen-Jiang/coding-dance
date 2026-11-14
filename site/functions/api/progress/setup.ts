// POST { star }：用模板在用户账号下生成 0 进度的进度仓；star 为 true 时顺手给模板仓点个 Star（界面上有明确的勾选框）
import { gh } from "../../_lib/progress";
import { type AuthEnv, getSession, privateJson, sameOrigin } from "../../_lib/session";

export const onRequestPost = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!sameOrigin(request)) return privateJson({ error: "不接受跨站请求" }, 403);
  const s = await getSession(request, env);
  if (!s) return privateJson({ error: "还没登录" }, 401);
  const body = (await request.json().catch(() => ({}))) as { star?: boolean };
  const repo = `${s.l}/${env.PROGRESS_REPO}`;

  let created = false;
  const exists = await gh(s.t, "GET", `/repos/${repo}`);
  if (!exists.ok) {
    const r = await gh(s.t, "POST", `/repos/${env.TEMPLATE_REPO}/generate`, {
      owner: s.l,
      name: env.PROGRESS_REPO,
      private: false,
      description: "我的 Hot 100 进度和题解（https://leetcode.cgent.link）",
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { message?: string };
      return privateJson({ error: `创建进度仓失败（GitHub ${r.status}${j.message ? `：${j.message}` : ""}）` }, 502);
    }
    created = true;
  }
  let starred = false;
  if (body.star) starred = (await gh(s.t, "PUT", `/user/starred/${env.TEMPLATE_REPO}`)).status === 204;
  return privateJson({ ok: true, created, starred, repo: { name: repo, url: `https://github.com/${repo}` } });
};
