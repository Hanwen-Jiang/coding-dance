// GitHub 回调（登录和安装都回到这里）：核对 state，用授权码换用户令牌，加密后写进 Cookie，再跳回原来的页面。
import {
  type AuthEnv, OAUTH_COOKIE, SESSION_COOKIE, SESSION_DAYS, authConfigured, exchangeToken, readCookie, safeReturn, seal, setCookie,
} from "../../_lib/session";

const back = (to: string, extra: string[] = []) => {
  const h = new Headers({ Location: to, "Cache-Control": "no-store" });
  h.append("Set-Cookie", setCookie(OAUTH_COOKIE, "", 0));
  for (const c of extra) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
};
const withFlag = (to: string, flag: string) => `${to}${to.includes("?") ? "&" : "?"}login=${flag}`;

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  if (!authConfigured(env)) return back("/?login=unavailable");
  const url = new URL(request.url);
  const [state, ret] = (readCookie(request, OAUTH_COOKIE) || "").split("|");
  const to = safeReturn(ret || "/");
  const code = url.searchParams.get("code");
  // 只改了安装的仓库、没有走授权时没有 code：直接回去
  if (!code && url.searchParams.get("setup_action")) return back(to);
  if (!code || !state || url.searchParams.get("state") !== state) return back(withFlag(to, "failed"));

  const tok = await exchangeToken(env, { code, redirect_uri: `${url.origin}/api/auth/callback` });
  if (!tok) return back(withFlag(to, "failed"));
  const ur = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tok.t}`, Accept: "application/vnd.github+json", "User-Agent": "lc-hot100-site" },
  });
  const u = (await ur.json().catch(() => ({}))) as { login?: string; avatar_url?: string };
  if (!u.login) return back(withFlag(to, "failed"));

  const value = await seal(env.SESSION_SECRET!, { ...tok, l: u.login, a: u.avatar_url || "", exp: Date.now() + SESSION_DAYS * 864e5 });
  return back(to, [setCookie(SESSION_COOKIE, value, SESSION_DAYS * 86400)]);
};
