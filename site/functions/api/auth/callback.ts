// GitHub 授权回调：核对 state，用 code 换用户令牌，加密后写进 Cookie，再跳回原来的页面。
import {
  type AuthEnv, OAUTH_COOKIE, SESSION_COOKIE, SESSION_DAYS, authConfigured, readCookie, safeReturn, seal, setCookie,
} from "../../_lib/session";

const back = (to: string, extra: string[] = []) => {
  const h = new Headers({ Location: to, "Cache-Control": "no-store" });
  h.append("Set-Cookie", setCookie(OAUTH_COOKIE, "", 0));
  for (const c of extra) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
};

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!authConfigured(env)) return back("/?login=unavailable");
  const url = new URL(request.url);
  const [state, ret] = (readCookie(request, OAUTH_COOKIE) || "").split("|");
  const to = safeReturn(ret || "/");
  const code = url.searchParams.get("code");
  if (!code || !state || url.searchParams.get("state") !== state) return back(`${to}${to.includes("?") ? "&" : "?"}login=failed`);

  const tr = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "lc-hot100-site" },
    body: JSON.stringify({ client_id: env.GITHUB_OAUTH_CLIENT_ID, client_secret: env.GITHUB_OAUTH_CLIENT_SECRET, code, redirect_uri: `${url.origin}/api/auth/callback` }),
  });
  const tj = (await tr.json().catch(() => ({}))) as { access_token?: string };
  if (!tj.access_token) return back(`${to}${to.includes("?") ? "&" : "?"}login=failed`);

  const ur = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tj.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "lc-hot100-site" },
  });
  const u = (await ur.json().catch(() => ({}))) as { login?: string; avatar_url?: string };
  if (!u.login) return back(`${to}${to.includes("?") ? "&" : "?"}login=failed`);

  const value = await seal(env.SESSION_SECRET!, { t: tj.access_token, l: u.login, a: u.avatar_url || "", exp: Date.now() + SESSION_DAYS * 864e5 });
  return back(to, [setCookie(SESSION_COOKIE, value, SESSION_DAYS * 86400)]);
};
