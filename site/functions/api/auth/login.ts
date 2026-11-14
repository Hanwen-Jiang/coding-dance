// 登录：跳到 GitHub App 的授权页。GitHub App 的权限在 App 设置里定好了（进度仓 Contents 读写、Starring），这里不传 scope。
import { type AuthEnv, authConfigured, privateJson, startState } from "../../_lib/session";

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!authConfigured(env)) return privateJson({ error: "GitHub 登录还没有配置" }, 503);
  const url = new URL(request.url);
  const { state, cookie } = startState(request);
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_APP_CLIENT_ID!);
  gh.searchParams.set("redirect_uri", `${url.origin}/api/auth/callback`);
  gh.searchParams.set("state", state);
  const h = new Headers({ Location: gh.toString(), "Cache-Control": "no-store" });
  h.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers: h });
};
