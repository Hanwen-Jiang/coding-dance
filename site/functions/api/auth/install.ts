// 授权：跳到 GitHub App 的授权页（GitHub 管它叫「安装」），让用户选授权范围。
// App 开了「安装时请求用户授权」，授权完 GitHub 会带着授权码回到 /api/auth/callback，顺便完成登录。
import { type AuthEnv, authConfigured, privateJson, startState } from "../../_lib/session";

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!authConfigured(env)) return privateJson({ error: "GitHub App 还没有配置" }, 503);
  const { state, cookie } = startState(request);
  const gh = new URL(`https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`);
  gh.searchParams.set("state", state);
  const h = new Headers({ Location: gh.toString(), "Cache-Control": "no-store" });
  h.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers: h });
};
