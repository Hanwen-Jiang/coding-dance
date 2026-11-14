// 登录会话：GitHub 给的用户令牌用 AES-GCM 加密后放在 HttpOnly Cookie 里，浏览器端的脚本读不到，也不会出现在任何响应里。
// 加密密钥来自 Pages 的加密环境变量 SESSION_SECRET。

export interface AuthEnv {
  SESSION_SECRET?: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  /** 0 进度的模板仓，owner/name */
  TEMPLATE_REPO: string;
  /** 用户进度仓的名字（建在用户自己的账号下） */
  PROGRESS_REPO: string;
}

export interface Session {
  /** GitHub 用户令牌 */
  t: string;
  /** 用户名 */
  l: string;
  /** 头像 */
  a: string;
  /** 过期时间（毫秒） */
  exp: number;
}

export const SESSION_COOKIE = "hot100_session";
export const OAUTH_COOKIE = "hot100_oauth";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();
const dec = new TextDecoder();

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
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
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

export const authConfigured = (env: AuthEnv) => !!(env.SESSION_SECRET && env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET);

export async function getSession(request: Request, env: AuthEnv): Promise<Session | null> {
  if (!env.SESSION_SECRET) return null;
  const v = readCookie(request, SESSION_COOKIE);
  return v ? unseal(env.SESSION_SECRET, v) : null;
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

export function privateJson(data: unknown, status = 200, extraHeaders: [string, string][] = []): Response {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" });
  for (const [k, v] of extraHeaders) h.append(k, v);
  return new Response(JSON.stringify(data), { status, headers: h });
}
