// GitHub 回调（登录和授权都回到这里，只在登录域名上）：核对 state，用授权码换用户令牌，加密后写进 Cookie，
// 再把会话交给发起登录的域名、顺路同步其余域名（见 _lib/sso.ts），最后跳回原来的页面。
// 第一次登录的用户还没有把 App 授权到自己账号上（GitHub 叫「安装」）：登录完直接接着去授权页，
// 这样在 GitHub 上一口气走完，回到网站时就可以直接建进度仓了。
import { userInstallation } from "../../_lib/install";
import {
  type AuthEnv, OAUTH_COOKIE, type Session, authConfigured, b64u, exchangeToken, getSession, newFamily, safeReturn, sessionCookie, setCookie,
} from "../../_lib/session";
import { destCookie, finishLogin, go, newSession, readDest, ssoOf, target, withFlag } from "../../_lib/sso";

export const onRequestGet = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  const s = await ssoOf(request, env);
  const d = readDest(request);
  const to = s ? target(s, d?.r) : safeReturn(d?.r && !/^https?:/i.test(d.r) ? d.r : "/");
  const clear = setCookie(OAUTH_COOKIE, "", 0);
  if (!authConfigured(env)) return go(withFlag(to, "unavailable"), [clear]);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // 只改了授权范围、没有走授权时没有 code：回去。是别的域名发起的，把登录域名上现有的会话交给它
  if (!code && url.searchParams.get("setup_action")) {
    if (s && d?.a) {
      const { session } = await getSession(request, env);
      if (session) {
        const sess: Session = session.f ? session : { ...session, f: newFamily() };
        return finishLogin(env, s, sess, d, [await sessionCookie(env, sess)], false);
      }
    }
    return go(to, [clear]);
  }
  if (!code || !d || url.searchParams.get("state") !== d.s) return go(withFlag(to, "failed"), [clear]);

  const tok = await exchangeToken(env, { code, redirect_uri: `${url.origin}/api/auth/callback` });
  if (!tok) return go(withFlag(to, "failed"), [clear]);
  const ur = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tok.t}`, Accept: "application/vnd.github+json", "User-Agent": "lc-hot100-site" },
  });
  const u = (await ur.json().catch(() => ({}))) as { login?: string; avatar_url?: string };
  if (!u.login) return go(withFlag(to, "failed"), [clear]);

  const sess = newSession(s, tok, u.login, u.avatar_url || "");
  const session = await sessionCookie(env, sess);
  // 刚从授权页回来（带 setup_action）就不再跳了；否则没授权过的用户接着去授权页，回来还是到这里
  if (!url.searchParams.get("setup_action") && !(await userInstallation(tok.t, u.login))) {
    const next = b64u(crypto.getRandomValues(new Uint8Array(18)));
    const gh = new URL(`https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`);
    gh.searchParams.set("state", next);
    return go(gh.toString(), [session, destCookie({ ...d, s: next })]);
  }
  return finishLogin(env, s, sess, d, [session]);
};
