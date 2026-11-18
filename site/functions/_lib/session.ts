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
  /** 「首批用户」的截止时间（ISO 时间）：在这之前授权网站或建好进度仓的用户，永久享有最高档 */
  FOUNDER_CUTOFF?: string;
  /**
   * 网站的几个域名（逗号分隔，带协议）。第一个是「登录域名」：GitHub App 的回调地址只登记了它，
   * 登录、授权都在它上面走，再把会话同步到其余域名（见 sso.ts）。不设或只有一个时，各域名各管各的。
   */
  SITE_ORIGINS?: string;
  /** 同一次登录在几个域名上共用一套令牌，令牌换新后存一份在这里，别的域名来取（见 getSession） */
  SESSIONS?: Kv;
}

/** Cloudflare KV 里用到的几个方法 */
export interface Kv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * 会员档位。现在只有「首批用户」（代码里叫 founder）这一种区别（订阅还没做，见 ROADMAP 阶段 7）：
 * 第一次授权网站或建好进度仓的时间早于 FOUNDER_CUTOFF 的，就是首批用户，永久最高档。数据来自 GitHub，网站不另存名单。
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
  /** 这次登录的编号：同步到几个域名的会话共用一个，换新的令牌按它存在 KV 里 */
  f?: string;
  /** 登录域名上记着：会话已经同步过的域名列表（originsTag），列表变了要再同步一次 */
  lk?: string;
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

/** 加密任意数据（会话、跨域名的一次性票据、KV 里的令牌都用它） */
export async function sealData(secret: string, data: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), enc.encode(JSON.stringify(data)));
  return `${b64u(iv)}.${b64u(ct)}`;
}

/** 解密；密文被改过或不是这把密钥加密的都返回 null */
export async function unsealData<T>(secret: string, value: string): Promise<T | null> {
  try {
    const [iv, ct] = value.split(".");
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(iv) }, await key(secret), unb64u(ct));
    return JSON.parse(dec.decode(pt)) as T;
  } catch {
    return null;
  }
}

export const seal = (secret: string, data: Session) => sealData(secret, data);

export async function unseal(secret: string, value: string): Promise<Session | null> {
  const s = await unsealData<Session>(secret, value);
  return s && typeof s.exp === "number" && s.exp > Date.now() ? s : null;
}

/** 新的登录编号 */
export const newFamily = () => b64u(crypto.getRandomValues(new Uint8Array(12)));

type Tokens = { t: string; r?: string; te?: number };
const famKey = (f: string) => `fam:${f}`;

/** KV 里这次登录最新的令牌（别的域名换过新的才有） */
async function readFamily(env: AuthEnv, f: string): Promise<Tokens | null> {
  if (!env.SESSIONS || !env.SESSION_SECRET) return null;
  const v = await env.SESSIONS.get(famKey(f)).catch(() => null);
  return v ? unsealData<Tokens>(env.SESSION_SECRET, v) : null;
}

async function writeFamily(env: AuthEnv, f: string, tok: Tokens, until: number) {
  if (!env.SESSIONS || !env.SESSION_SECRET) return;
  const ttl = Math.max(60, Math.ceil((until - Date.now()) / 1000));
  await env.SESSIONS.put(famKey(f), await sealData(env.SESSION_SECRET, { t: tok.t, r: tok.r, te: tok.te }), { expirationTtl: ttl }).catch(() => {});
}

/** 退出时删掉这次登录在 KV 里的令牌 */
export async function dropFamily(env: AuthEnv, f?: string) {
  if (f && env.SESSIONS) await env.SESSIONS.delete(famKey(f)).catch(() => {});
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

/** 把会话写回 Cookie（有效期跟着会话本身走） */
export async function sessionCookie(env: AuthEnv, s: Session): Promise<string> {
  return setCookie(SESSION_COOKIE, await seal(env.SESSION_SECRET!, s), Math.max(0, Math.floor((s.exp - Date.now()) / 1000)));
}

/**
 * 读出当前会话；令牌快过期时用 refresh token 换新的。
 * cookie 不为空时，调用方要把它加到响应的 Set-Cookie 里。
 *
 * 同一次登录会同步到几个域名（sso.ts），它们的 Cookie 里是同一套令牌。GitHub 的 refresh token 只能用一次，
 * 用过之后旧的令牌也一起作废，所以换新之前先看 KV：别的域名已经换过的话直接用它换来的；
 * 自己换成功了就存进 KV 给别的域名用；两个域名同时换、自己没换上的，等一下再去 KV 里取。
 */
export async function getSession(request: Request, env: AuthEnv): Promise<{ session: Session | null; cookie: string | null }> {
  if (!env.SESSION_SECRET) return { session: null, cookie: null };
  const v = readCookie(request, SESSION_COOKIE);
  const s = v ? await unseal(env.SESSION_SECRET, v) : null;
  if (!s) return { session: null, cookie: null };
  if (!s.te || s.te - Date.now() > 5 * 60e3) return { session: s, cookie: null };
  const adopt = async (tok: Tokens) => {
    const next: Session = { ...s, t: tok.t, r: tok.r ?? s.r, te: tok.te };
    return { session: next, cookie: await sessionCookie(env, next) };
  };
  const newer = (tok: Tokens | null): tok is Tokens => !!tok && tok.t !== s.t && (tok.te ?? Infinity) > (s.te ?? 0);
  // 快过期了：别的域名换过了就直接用
  const known = s.f ? await readFamily(env, s.f) : null;
  if (newer(known)) return adopt(known);
  const fresh = s.r && authConfigured(env) ? await exchangeToken(env, { grant_type: "refresh_token", refresh_token: s.r }) : null;
  if (fresh) {
    const tok = { ...fresh, r: fresh.r ?? s.r };
    if (s.f) await writeFamily(env, s.f, tok, s.exp);
    return adopt(tok);
  }
  // 没换上：可能另一个域名刚好同时在换，等它存进 KV
  for (const wait of s.f && env.SESSIONS ? [400, 1200] : []) {
    await new Promise((r) => setTimeout(r, wait));
    const later = await readFamily(env, s.f!);
    if (newer(later)) return adopt(later);
  }
  return { session: null, cookie: setCookie(SESSION_COOKIE, "", 0) };
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
