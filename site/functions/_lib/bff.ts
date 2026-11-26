import { requestOrigin } from "./session.ts";

// Cloudflare Pages 边缘 BFF 反向代理：将认证、进度、设置、题解、同步、运行与伴学路由透明转发至 Go 统一后端 cd-api。
export interface BffEnv {
  CD_API_UPSTREAM?: string;
  CD_API_ACCESS_ID?: string;
  CD_API_ACCESS_SECRET?: string;
  TEMPLATE_REPO?: string;
  PROGRESS_REPO?: string;
  SITE_ORIGINS?: string;
  EDGE_PROXY_KEY?: string;
}

const BFF_EXACT_PATHS = new Set(["/api/session", "/api/progress", "/api/settings", "/api/run", "/api/dap", "/api/admin/runner"]);
const BFF_PREFIX_PATHS = ["/api/auth/", "/api/progress/", "/api/solutions/", "/api/sync/", "/api/companion/"];

export function isBffPath(pathname: string): boolean {
  return BFF_EXACT_PATHS.has(pathname) || BFF_PREFIX_PATHS.some((prefix) => pathname.startsWith(prefix));
}

export function isEdgeFallbackPath(pathname: string): boolean {
  return pathname === "/api/run" || pathname === "/api/dap" || pathname === "/api/admin/runner" || pathname.startsWith("/api/companion/");
}

const FORWARD_HEADERS = [
  "cookie",
  "origin",
  "content-type",
  "accept",
  "authorization",
  "user-agent",
  "upgrade",
  "connection",
  "sec-websocket-key",
  "sec-websocket-version",
  "sec-websocket-protocol",
  "sec-websocket-extensions",
];

function buildForwardHeaders(request: Request, _url: URL, env: BffEnv): Headers {
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const val = request.headers.get(name);
    if (val) headers.set(name, val);
  }
  const publicOrigin = new URL(requestOrigin(request, env));
  headers.set("X-Forwarded-Host", publicOrigin.host);
  headers.set("X-Forwarded-Proto", publicOrigin.protocol.replace(":", ""));
  const clientIP = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For");
  if (clientIP) headers.set("X-Forwarded-For", clientIP);
  const accessId = (env.CD_API_ACCESS_ID || "").trim();
  const accessSecret = (env.CD_API_ACCESS_SECRET || "").trim();
  if (accessId && accessSecret) {
    headers.set("CF-Access-Client-Id", accessId);
    headers.set("CF-Access-Client-Secret", accessSecret);
  }
  return headers;
}

function copyResponseWithCookies(upstreamRes: Response): Response {
  const headers = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") headers.append(key, value);
  });
  const getSetCookie = (upstreamRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = typeof getSetCookie === "function"
    ? getSetCookie.call(upstreamRes.headers)
    : upstreamRes.headers.get("set-cookie")
      ? [upstreamRes.headers.get("set-cookie")!]
      : [];
  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers,
  });
}

function privateJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function handleBffRequest(ctx: { request: Request; env: BffEnv; next: () => Promise<Response> }): Promise<Response> {
  const url = new URL(ctx.request.url);
  if (!isBffPath(url.pathname)) return ctx.next();

  const upstream = (ctx.env.CD_API_UPSTREAM || "").trim().replace(/\/+$/, "");
  // 渐进灰度保护：未配置 CD_API_UPSTREAM 时全部回退到既有 Pages Functions，保障线上生产零中断
  if (!upstream) {
    return ctx.next();
  }

  const targetUrl = `${upstream}${url.pathname}${url.search}`;
  const headers = buildForwardHeaders(ctx.request, url, ctx.env);
  if ((ctx.request.headers.get("Upgrade") || "").toLowerCase() === "websocket") {
    return fetch(targetUrl, { method: ctx.request.method, headers, redirect: "manual" });
  }
  const hasBody = ctx.request.method !== "GET" && ctx.request.method !== "HEAD";
  const body = hasBody ? await ctx.request.arrayBuffer() : undefined;
  const upstreamRes = await fetch(targetUrl, {
    method: ctx.request.method,
    headers,
    body,
    redirect: "manual",
  });
  return copyResponseWithCookies(upstreamRes);
}
