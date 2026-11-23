// 几个域名共用登录（SITE_ORIGINS，第一个是「登录域名」）。
//
// 浏览器不让不同域名之间共用 Cookie，嵌 iframe 读第三方 Cookie 的办法也已经被浏览器挡掉，所以靠整页跳转传会话：
//   - 登录、授权都在登录域名上走 GitHub（GitHub App 的回调地址只登记了它）。在别的域名点登录，先跳到登录域名，
//     登录域名已经有会话就不用再去 GitHub。
//   - 登录域名把会话装进一张一次性票据（用 SESSION_SECRET 加密，2 分钟过期，只给指定域名用），跳回那个域名的
//     /api/auth/accept，它核对票据后写自己的 Cookie。票据还和对方域名上一个随机数 Cookie 绑在一起：
//     只有在这个浏览器上从那个域名发起的跳转才认，别人拿着自己的票据链接骗不了你登录成他的账号。
//   - 登录成功后顺着 SITE_ORIGINS 把其余域名都走一遍（每个域名三次跳转），之后在哪个域名打开都是登录状态。
//     以前只在登录域名上登录过的用户，首页加载时会补走一遍（/api/session 返回 spread）。
//   - 退出时同样走一遍，把每个域名的会话都清掉。
// 这几个域名的会话是同一套 GitHub 令牌；令牌换新的问题在 session.ts 的 getSession 里处理（KV）。
import {
  type AuthEnv, type Session, OAUTH_COOKIE, SESSION_COOKIE, SESSION_DAYS, b64u, clean, dropFamily, getSession, newFamily, privateJson, readCookie, safeReturn,
  sameOrigin, sealData, sessionCookie, setCookie, unseal, unsealData,
} from "./session.ts";

/** 发起跳转的域名上记的随机数，票据要和它对上 */
export const LINK_COOKIE = "hot100_link";
const TICKET_MS = 120e3;

export interface Sso {
  /** 当前请求的域名 */
  here: string;
  /** 登录域名 */
  hub: string;
  all: string[];
  /** 除登录域名以外的域名 */
  others: string[];
  /** 域名列表的摘要：列表变了，已经登录的用户要再同步一次 */
  tag: string;
}

/** 解析 SITE_ORIGINS：只认 http(s)://主机[:端口]，去掉重复 */
export function siteOrigins(env: Pick<AuthEnv, "SITE_ORIGINS">): string[] {
  const out: string[] = [];
  for (const raw of (env.SITE_ORIGINS || "").split(",")) {
    const v = raw.trim().replace(/\/+$/, "");
    if (/^https?:\/\/[\w.-]+(:\d+)?$/.test(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

/** 当前请求要不要走多域名登录：列表里至少两个域名，并且当前域名在列表里（pages.dev 之类的预览地址不参与） */
export async function ssoOf(request: Request, env: AuthEnv): Promise<Sso | null> {
  const all = siteOrigins(env);
  const here = new URL(request.url).origin;
  if (all.length < 2 || !all.includes(here) || !env.SESSION_SECRET) return null;
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(all.join(","))));
  return { here, hub: all[0], all, others: all.slice(1), tag: b64u(hash).slice(0, 10) };
}

/** 跳转的终点：本站相对路径，或者列表里某个域名的完整地址；别的一律回当前域名首页 */
export function target(s: Sso, v: string | null | undefined): string {
  if (v && /^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (s.all.includes(u.origin)) return u.origin + safeReturn(u.pathname + u.search + u.hash);
    } catch { /* 不是合法地址 */ }
    return `${s.here}/`;
  }
  return s.here + safeReturn(v ?? null);
}

/** 还要走的域名（只认列表里的，去重） */
export function restOf(s: Sso, v: string | null | undefined): string[] {
  const out: string[] = [];
  for (const o of (v || "").split(",")) if (s.all.includes(o) && !out.includes(o)) out.push(o);
  return out;
}

/** 302 跳转。Referrer-Policy: no-referrer，带票据的地址不会经 Referer 传给下一站 */
export function go(to: string, cookies: (string | null)[] = []): Response {
  const h = new Headers({ Location: to, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  for (const c of cookies) if (c) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}

export const withFlag = (to: string, flag: string) => {
  const [base, hash = ""] = to.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}login=${flag}${hash ? `#${hash}` : ""}`;
};

/** 开通页：登录、授权完进度仓还不能用的用户先到这里建好它，再回原来的页面（components/onboarding.tsx） */
export const SETUP_PATH = "/welcome/";

/**
 * 把登录后的终点换成开通页，原来的终点放进 return。r 是相对路径，或者列表里某个域名的完整地址（多域名时）；
 * 本来就是开通页的不再套一层。
 */
export function viaSetup(r: string): string {
  const m = /^(https?:\/\/[^/?#]+)(.*)$/i.exec(r);
  const origin = m ? m[1] : "";
  const path = (m ? m[2] : r) || "/";
  if (path.startsWith(SETUP_PATH)) return r;
  return `${origin}${SETUP_PATH}${path === "/" ? "" : `?return=${encodeURIComponent(path)}`}`;
}

/** 下一站：还有没走的域名就去它那里领会话，否则回到终点 */
function nextHop(ret: string, rest: string[]): string {
  if (!rest.length) return ret;
  const u = new URL(`${rest[0]}/api/auth/link`);
  u.searchParams.set("mode", "chain");
  u.searchParams.set("return", ret);
  if (rest.length > 1) u.searchParams.set("rest", rest.slice(1).join(","));
  return u.toString();
}

// —— 去 GitHub ——

/** 去 GitHub 之前记下的东西：防 CSRF 的 state、回来后去哪、是不是替别的域名登录（那个域名和它的随机数） */
export interface Dest { s: string; r: string; a?: string; n?: string }

export function readDest(request: Request): Dest | null {
  const raw = readCookie(request, OAUTH_COOKIE);
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      const d = JSON.parse(raw) as Dest;
      return typeof d.s === "string" && typeof d.r === "string" ? d : null;
    } catch { return null; }
  }
  const [s, r] = raw.split("|"); // 上线前发出去的旧格式：state|相对路径
  return s ? { s, r: r || "/" } : null;
}

export function destCookie(d: Dest): string {
  return setCookie(OAUTH_COOKIE, JSON.stringify(d), 900);
}

/** 跳去 GitHub 登录（OAuth 授权页）或授权（App 的安装页）。回调都是登录域名的 /api/auth/callback */
export function githubStart(request: Request, env: AuthEnv, mode: "login" | "install", d: Omit<Dest, "s">): Response {
  const state = b64u(crypto.getRandomValues(new Uint8Array(18)));
  let gh: URL;
  if (mode === "login") {
    gh = new URL("https://github.com/login/oauth/authorize");
    gh.searchParams.set("client_id", clean(env.GITHUB_APP_CLIENT_ID));
    gh.searchParams.set("redirect_uri", `${new URL(request.url).origin}/api/auth/callback`);
  } else {
    gh = new URL(`https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`);
  }
  gh.searchParams.set("state", state);
  return go(gh.toString(), [destCookie({ ...d, s: state })]);
}

/** 登录、授权的入口（/api/auth/login、/api/auth/install）：别的域名先跳到登录域名，登录域名自己直接去 GitHub */
export async function authEntry(request: Request, env: AuthEnv, mode: "login" | "install"): Promise<Response> {
  const s = await ssoOf(request, env);
  const ret = new URL(request.url).searchParams.get("return");
  if (s && s.here !== s.hub) return startLink(s, mode, target(s, ret), []);
  return githubStart(request, env, mode, { r: s ? target(s, ret) : safeReturn(ret) });
}

// —— 跨域名的几站 ——

/** 第一站（任何一个域名）：记下随机数，带着它去登录域名领票据 */
export function startLink(s: Sso, mode: "login" | "install" | "chain", ret: string, rest: string[]): Response {
  const n = b64u(crypto.getRandomValues(new Uint8Array(18)));
  const u = new URL(`${s.hub}/api/auth/bridge`);
  u.searchParams.set("aud", s.here);
  u.searchParams.set("n", n);
  u.searchParams.set("mode", mode);
  u.searchParams.set("return", ret);
  if (rest.length) u.searchParams.set("rest", rest.join(","));
  return go(u.toString(), [setCookie(LINK_COOKIE, n, 600)]);
}

/** GET /api/auth/link?mode=&return=&rest= */
export async function onLink(request: Request, env: AuthEnv): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const s = await ssoOf(request, env);
  if (!s) return go(safeReturn(q.get("return")));
  const m = q.get("mode");
  return startLink(s, m === "login" || m === "install" ? m : "chain", target(s, q.get("return")), restOf(s, q.get("rest")));
}

interface Ticket { k: "t"; aud: string; n: string; x: number; s: Session }

/** 给某个域名开票据，跳到它的 /api/auth/accept */
async function ticketHop(env: AuthEnv, sess: Session, aud: string, n: string, ret: string, rest: string[], login: boolean): Promise<string> {
  const t: Ticket = { k: "t", aud, n, x: Date.now() + TICKET_MS, s: { ...sess, lk: undefined } };
  const u = new URL(`${aud}/api/auth/accept`);
  u.searchParams.set("t", await sealData(env.SESSION_SECRET!, t));
  u.searchParams.set("return", ret);
  if (rest.length) u.searchParams.set("rest", rest.join(","));
  if (login) u.searchParams.set("m", "login");
  return u.toString();
}

/** 登录域名上的会话还能不能用（用户可能在 GitHub 上撤销了授权）。只在用户点登录时查 */
async function alive(sess: Session): Promise<boolean> {
  const r = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${sess.t}`, Accept: "application/vnd.github+json", "User-Agent": "lc-hot100-site" },
  }).catch(() => null);
  return !r || r.status !== 401; // 网络问题不算失效
}

/**
 * GET /api/auth/bridge?aud=&n=&mode=&return=&rest=（只在登录域名上）
 * 有会话就给 aud 开票据；没有的话，用户点的是登录 / 授权就去 GitHub，顺路同步时直接回终点。
 */
export async function onBridge(request: Request, env: AuthEnv): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const s = await ssoOf(request, env);
  if (!s || s.here !== s.hub) return go("/");
  const aud = q.get("aud") || "";
  const n = q.get("n") || "";
  const ret = target(s, q.get("return"));
  const rest = restOf(s, q.get("rest")).filter((o) => o !== aud);
  if (!s.all.includes(aud) || !n) return go(ret);
  const mode = q.get("mode");
  if (mode === "install") return githubStart(request, env, "install", { r: ret, a: aud, n });

  const { session, cookie } = await getSession(request, env);
  const ok = session && (mode !== "login" || (await alive(session)));
  if (!ok) {
    if (mode === "login") return githubStart(request, env, "login", { r: ret, a: aud, n });
    return go(nextHop(ret, rest), [cookie]);
  }
  // 以前的会话没有登录编号：补上，登录域名自己的 Cookie 也一起改
  const sess: Session = session.f ? session : { ...session, f: newFamily() };
  const own = sess !== session || cookie ? await sessionCookie(env, sess) : null;
  return go(await ticketHop(env, sess, aud, n, ret, rest, mode === "login"), [own]);
}

/** GET /api/auth/accept?t=&return=&rest=&m= ：核对票据，写自己的 Cookie，再去下一站 */
export async function onAccept(request: Request, env: AuthEnv): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const s = await ssoOf(request, env);
  if (!s) return go(safeReturn(q.get("return")));
  let ret = target(s, q.get("return"));
  const rest = restOf(s, q.get("rest")).filter((o) => o !== s.here);
  const n = readCookie(request, LINK_COOKIE);
  const t = q.get("t");
  const tk = t ? await unsealData<Ticket>(env.SESSION_SECRET!, t) : null;
  const ok = !!tk && tk.k === "t" && tk.aud === s.here && tk.x > Date.now() && !!n && tk.n === n && !!tk.s && tk.s.exp > Date.now();
  const cookies = [setCookie(LINK_COOKIE, "", 0)];
  if (ok) cookies.push(await sessionCookie(env, tk.s));
  else if (q.get("m") === "login") ret = withFlag(ret, "failed");
  return go(nextHop(ret, rest), cookies);
}

/**
 * 登录域名上 GitHub 回调成功之后：写好登录域名的会话（调用方给的 cookies 里），再把会话交给发起登录的域名，
 * 并顺路同步其余域名（spread 为 false 时只交给发起的域名）。
 */
export async function finishLogin(env: AuthEnv, s: Sso | null, sess: Session, d: Dest | null, cookies: (string | null)[], spread = true): Promise<Response> {
  const clear = setCookie(OAUTH_COOKIE, "", 0);
  if (!s) return go(safeReturn(d?.r && !/^https?:/i.test(d.r) ? d.r : "/"), [clear, ...cookies]);
  const ret = target(s, d?.r);
  const pending = spread ? s.others : [];
  if (d?.a && d.n && d.a !== s.hub && s.all.includes(d.a)) {
    const rest = pending.filter((o) => o !== d.a);
    return go(await ticketHop(env, sess, d.a, d.n, ret, rest, true), [clear, ...cookies]);
  }
  return go(nextHop(ret, pending), [clear, ...cookies]);
}

/** 登录成功时新建的会话：带上登录编号；在登录域名上记下已经同步过的域名列表 */
export function newSession(s: Sso | null, tok: { t: string; r?: string; te?: number }, login: string, avatar: string): Session {
  return { ...tok, l: login, a: avatar, exp: Date.now() + SESSION_DAYS * 864e5, f: newFamily(), lk: s?.tag };
}

/**
 * GET /api/auth/spread?to=&return=（只在登录域名上）：以前只在登录域名上登录过的会话，补着同步到 to 里的域名
 * （页面先测过哪些域名连得上）。不管同步成没成，都记下已经同步过，不会反复跳。
 */
export async function onSpread(request: Request, env: AuthEnv): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const s = await ssoOf(request, env);
  if (!s) return go(safeReturn(q.get("return")));
  const ret = target(s, q.get("return"));
  if (s.here !== s.hub) return go(ret);
  const { session, cookie } = await getSession(request, env);
  if (!session) return go(ret, [cookie]);
  const marked: Session = { ...session, f: session.f ?? newFamily(), lk: s.tag };
  const to = restOf(s, q.get("to")).filter((o) => o !== s.hub);
  return go(nextHop(ret, to), [await sessionCookie(env, marked)]);
}

/** /api/session 里告诉页面：这个会话还没同步到其余域名，要补一次（返回要同步的域名） */
export async function needSpread(request: Request, env: AuthEnv, sess: Session): Promise<string[] | null> {
  const s = await ssoOf(request, env);
  return s && s.here === s.hub && sess.lk !== s.tag ? s.others : null;
}

interface SignoutToken { k: "o"; x: number }

/**
 * POST /api/auth/logout?return=：清掉当前域名的会话；有别的域名时返回 next，页面跳过去把它们也清掉。
 * KV 里这次登录的令牌也删掉。
 */
export async function onLogout(request: Request, env: AuthEnv): Promise<Response> {
  if (!sameOrigin(request)) return privateJson({ error: "不接受跨站请求" }, 403);
  const v = readCookie(request, SESSION_COOKIE);
  const sess = v && env.SESSION_SECRET ? await unseal(env.SESSION_SECRET, v) : null;
  await dropFamily(env, sess?.f);
  const cookies = [setCookie(SESSION_COOKIE, "", 0)];
  const s = await ssoOf(request, env);
  if (!s) return privateJson({ ok: true }, 200, cookies);
  const rest = s.all.filter((o) => o !== s.here);
  const tok: SignoutToken = { k: "o", x: Date.now() + TICKET_MS };
  const u = new URL(`${rest[0]}/api/auth/signout`);
  u.searchParams.set("t", await sealData(env.SESSION_SECRET!, tok));
  u.searchParams.set("return", target(s, new URL(request.url).searchParams.get("return")));
  if (rest.length > 1) u.searchParams.set("rest", rest.slice(1).join(","));
  return privateJson({ ok: true, next: u.toString() }, 200, cookies);
}

/** GET /api/auth/signout?t=&return=&rest= ：退出时顺路清掉这个域名的会话。t 是 logout 发的，挡住别的网站随手让你退出 */
export async function onSignout(request: Request, env: AuthEnv): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const s = await ssoOf(request, env);
  if (!s) return go(safeReturn(q.get("return")));
  const ret = target(s, q.get("return"));
  const t = q.get("t") || "";
  const tok = t ? await unsealData<SignoutToken>(env.SESSION_SECRET!, t) : null;
  if (!tok || tok.k !== "o" || tok.x < Date.now()) return go(ret);
  const rest = restOf(s, q.get("rest")).filter((o) => o !== s.here);
  let to = ret;
  if (rest.length) {
    const u = new URL(`${rest[0]}/api/auth/signout`);
    u.searchParams.set("t", t);
    u.searchParams.set("return", ret);
    if (rest.length > 1) u.searchParams.set("rest", rest.slice(1).join(","));
    to = u.toString();
  }
  return go(to, [setCookie(SESSION_COOKIE, "", 0), setCookie(LINK_COOKIE, "", 0)]);
}
