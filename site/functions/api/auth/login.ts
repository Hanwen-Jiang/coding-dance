// 跳到 GitHub 授权页。只申请 public_repo：创建和读写用户公开的进度仓、给模板仓点 Star。
import { type AuthEnv, OAUTH_COOKIE, authConfigured, b64u, privateJson, safeReturn, setCookie } from "../../_lib/session";

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!authConfigured(env)) return privateJson({ error: "GitHub 登录还没有配置" }, 503);
  const url = new URL(request.url);
  const state = b64u(crypto.getRandomValues(new Uint8Array(18)));
  const back = safeReturn(url.searchParams.get("return"));
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID!);
  gh.searchParams.set("redirect_uri", `${url.origin}/api/auth/callback`);
  gh.searchParams.set("scope", "public_repo");
  gh.searchParams.set("state", state);
  const h = new Headers({ Location: gh.toString(), "Cache-Control": "no-store" });
  h.append("Set-Cookie", setCookie(OAUTH_COOKIE, `${state}|${back}`, 600));
  return new Response(null, { status: 302, headers: h });
};
