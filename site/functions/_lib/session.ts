// 登录会话（GitHub App 的用户令牌）。令牌用 AES-GCM 加密后放在 HttpOnly Cookie 里，浏览器端的脚本读不到，也不会出现在任何响应里。
// GitHub App 的用户令牌 8 小时过期，Cookie 里同时存着 refresh token（6 个月有效），快过期时服务端自动换新。
// 加密密钥来自 Pages 的加密环境变量 SESSION_SECRET。

export interface AuthEnv {
  SESSION_SECRET?: string;
  /** GitHub App 的 client id / client secret（加密环境变量） */
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  /** GitHub App 的 slug，用来拼安装链接：https://github.com/apps/<slug> */
  GITHUB_APP_SLUG?: string;
  /** 0 进度的模板仓，owner/name */
  TEMPLATE_REPO: string;
  /** 用户进度仓的名字（建在用户自己的账号下） */
  PROGRESS_REPO: string;
  /** 页面上请用户点 Star 的仓库，逗号分隔的 owner/name；不设就只有模板仓 */
  STAR_REPOS?: string;
  /** 创始会员的截止时间（ISO 时间）：在这之前授权网站或建好进度仓的用户，永久享有最高档 */
  FOUNDER_CUTOFF?: string;
}

/**
 * 会员档位。现在只有创始会员这一种区别（订阅还没做，见 ROADMAP 阶段 7）：
 * 第一次授权网站或建好进度仓的时间早于 FOUNDER_CUTOFF 的，就是创始会员，永久最高档。数据来自 GitHub，网站不另存名单。
 */
export function membership(env: AuthEnv, joinedAt: (string | null | undefined)[]) {
  const cutoff = Date.parse(env.FOUNDER_CUTOFF || "");
  const first = joinedAt.map((t) => Date.parse(t || "")).filter(Number.isFinite).sort((a, b) => a - b)[0];
  const founder = Number.isFinite(cutoff) && first !== undefined && first < cutoff;
  return founder
    ? { tier: "pro" as const, founder: true, since: new Date(first).toISOString().slice(0, 10) }
    : { tier: "free" as const, founder: false, since: null };
}

/** 请用户点 Star 的仓库列表（只认 owner/name 这种写法） */
export const starRepos = (env: AuthEnv) =>
  (env.STAR_REPOS || env.TEMPLATE_REPO).split(",").map((s) => s.trim()).filter((s) => /^[\w.-]+\/[\w.-]+$/.test(s));

export interface Session {
  /** GitHub 用户令牌 */
  t: string;
  /** refresh token（没开令牌过期时没有） */
  r?: string;
  /** 令牌过期时间（毫秒） */
  te?: number;
  /** 用户名 */
  l: string;
  /** 头像 */
  a: string;
  /** 会话过期时间（毫秒） */
  exp: number;
}

export const SESSION_COOKIE = "hot100_session";
export const OAUTH_COOKIE = "hot100_oauth";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** 通过 PowerShell 管道写入的 secret 可能带 BOM 或换行；trim() 两样都会去掉 */
export const clean = (v?: string) => (v || "").trim();

export const b64u = (bytes: ArrayBuffer | Uint8Array) => {
  const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of a) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function key(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret.trim()));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(secret: string, data: Session): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), enc.encode(JSON.stringify(data)));
  return `${b64u(iv)}.${b64u(ct)}`;
}

export async function unseal(secret: string, value: string): Promise<Session | null> {
  try {
    const [iv, ct] = value.split(".");
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(iv) }, await key(secret), unb64u(ct));
    const s = JSON.parse(dec.decode(pt)) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export const authConfigured = (env: AuthEnv) => !!(env.SESSION_SECRET && env.GITHUB_APP_CLIENT_ID && env.GITHUB_APP_CLIENT_SECRET && env.GITHUB_APP_SLUG);

/** 用授权码或 refresh token 换用户令牌 */
export async function exchangeToken(env: AuthEnv, params: Record<string, string>) {
  const r = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "lc-hot100-site" },
    body: JSON.stringify({ client_id: clean(env.GITHUB_APP_CLIENT_ID), client_secret: clean(env.GITHUB_APP_CLIENT_SECRET), ...params }),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  return { t: j.access_token, r: j.refresh_token, te: j.expires_in ? Date.now() + j.expires_in * 1000 : undefined };
}

/**
 * 读出当前会话；令牌快过期时用 refresh token 换新的。
 * cookie 不为空时，调用方要把它加到响应的 Set-Cookie 里。
 */
export async function getSession(request: Request, env: AuthEnv): Promise<{ session: Session | null; cookie: string | null }> {
  if (!env.SESSION_SECRET) return { session: null, cookie: null };
  const v = readCookie(request, SESSION_COOKIE);
  const s = v ? await unseal(env.SESSION_SECRET, v) : null;
  if (!s) return { session: null, cookie: null };
  if (!s.te || s.te - Date.now() > 5 * 60e3) return { session: s, cookie: null };
  // 快过期了：换新令牌
  const fresh = s.r && authConfigured(env) ? await exchangeToken(env, { grant_type: "refresh_token", refresh_token: s.r }) : null;
  if (!fresh) return { session: null, cookie: setCookie(SESSION_COOKIE, "", 0) };
  const next: Session = { ...s, ...fresh, r: fresh.r ?? s.r };
  return { session: next, cookie: setCookie(SESSION_COOKIE, await seal(env.SESSION_SECRET, next), SESSION_DAYS * 86400) };
}

/** 写操作只接受本站页面发起的请求，挡住别的网站借用户的 Cookie 发请求 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return !!origin && origin === new URL(request.url).origin;
}

/** 登录后跳回的地址只允许本站的相对路径 */
export function safeReturn(v: string | null): string {
  return v && /^\/(?!\/)[\w\-./?=&%#]*$/.test(v) ? v : "/";
}

export function privateJson(data: unknown, status = 200, cookies: (string | null)[] = []): Response {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" });
  for (const c of cookies) if (c) h.append("Set-Cookie", c);
  return new Response(JSON.stringify(data), { status, headers: h });
}

/** 跳去 GitHub 之前，记下 state（防 CSRF）和回来后要去的页面 */
export function startState(request: Request): { state: string; cookie: string } {
  const state = b64u(crypto.getRandomValues(new Uint8Array(18)));
  const back = safeReturn(new URL(request.url).searchParams.get("return"));
  return { state, cookie: setCookie(OAUTH_COOKIE, `${state}|${back}`, 900) };
}
