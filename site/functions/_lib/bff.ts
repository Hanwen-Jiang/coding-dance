// Cloudflare Pages 边缘 BFF 反向代理：将认证、进度、设置、题解、同步、运行与伴学路由透明转发至 Go 统一后端 cd-api。
export interface BffEnv {
  CD_API_UPSTREAM?: string;
  CD_API_ACCESS_ID?: string;
  CD_API_ACCESS_SECRET?: string;
  TEMPLATE_REPO?: string;
  PROGRESS_REPO?: string;
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

function buildForwardHeaders(request: Request, url: URL, env: BffEnv): Headers {
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const val = request.headers.get(name);
    if (val) headers.set(name, val);
  }
  headers.set("X-Forwarded-Host", url.host);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
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
  if (!upstream) {
    if (ctx.request.method === "GET" && url.pathname === "/api/session") {
      return privateJson({
        configured: false,
        template: ctx.env.TEMPLATE_REPO || "Hanwen-Jiang/hot100-progress-template",
        repoName: ctx.env.PROGRESS_REPO || "hot100-progress",
        createUrl: "",
        user: null,
        repo: null,
        starred: false,
        stars: [],
      }, 200);
    }
    if (isEdgeFallbackPath(url.pathname)) return ctx.next();
    return privateJson({ error: "cd-api BFF 服务尚未配置（请设置 CD_API_UPSTREAM）" }, 503);
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
