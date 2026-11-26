import { type AuthEnv, clean, getSession, privateJson, sameOrigin } from "./session.ts";

export interface CompanionEnv extends AuthEnv {
  /** coding-agent 服务根地址，如 https://code.cgent.link */
  CODING_AGENT_URL?: string;
  /** coding-agent 上配置的 CODING_DANCE_API_TOKEN（只放 Pages 加密环境变量） */
  CODING_DANCE_API_TOKEN?: string;
  /** 可选：练习提交事件推送的 coding_dance Webhook 地址与密钥 */
  CODING_DANCE_WEBHOOK_URL?: string;
  CODING_DANCE_WEBHOOK_SECRET?: string;
}

export type CompanionEndpoint = "hint-check" | "hint-reveal" | "history-analyze";

const MAX_BODY = 131_072; // 128 KiB
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_PER_MIN = 30;
const rateBuckets = new Map<string, number[]>();

export function clearCompanionRateMemory() {
  rateBuckets.clear();
}

export function companionConfigured(env: CompanionEnv): boolean {
  return !!(clean(env.CODING_AGENT_URL) && clean(env.CODING_DANCE_API_TOKEN));
}

/** 将 GitHub 用户名规范成 coding-agent 租户/用户 slug（^[a-z0-9][a-z0-9_-]{0,62}$） */
export function sanitizeCompanionUser(login?: string | null): string {
  const raw = (login || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+/, "");
  if (!raw) return "guest";
  return `gh-${raw}`.slice(0, 63);
}

/** 单实例每分钟滑动窗口限流（防止未登录访客刷爆上游伴学接口） */
export function admitCompanionCall(actorKey: string, limitPerMin = RATE_LIMIT_PER_MIN, now = Date.now()): boolean {
  const hits = (rateBuckets.get(actorKey) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (hits.length >= limitPerMin) {
    rateBuckets.set(actorKey, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(actorKey, hits);
  if (rateBuckets.size > 4096) {
    for (const [k, list] of rateBuckets) {
      if (!list.some((ts) => now - ts < RATE_WINDOW_MS)) rateBuckets.delete(k);
    }
  }
  return true;
}

/** Edge-side Consent-First proxy for /api/integrations/coding-dance/v1/*. */
export async function forwardCompanion(
  request: Request,
  env: CompanionEnv,
  endpoint: CompanionEndpoint,
  opts: { requireAuth?: boolean; fetchImpl?: typeof fetch; now?: number } = {},
): Promise<Response> {
  if (!sameOrigin(request, env)) {
    return privateJson({ error: "不接受跨站请求" }, 403);
  }
  if (!companionConfigured(env)) {
    return privateJson({ error: "伴学服务暂未配置" }, 503);
  }

  const { session, cookie } = await getSession(request, env).catch(() => ({ session: null, cookie: null }));
  if (opts.requireAuth && !session) {
    return privateJson({ error: "请先用 GitHub 登录后再使用历史复盘" }, 401, [cookie]);
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY) {
    return privateJson({ error: "请求内容过大（上限 128 KB）" }, 413, [cookie]);
  }
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return privateJson({ error: "请求体必须是 JSON 对象" }, 400, [cookie]);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return privateJson({ error: "JSON 格式不合法" }, 400, [cookie]);
  }

  const actorKey = session ? `u:${session.l}` : `ip:${request.headers.get("CF-Connecting-IP") || "anon"}`;
  if (!admitCompanionCall(actorKey, RATE_LIMIT_PER_MIN, opts.now ?? Date.now())) {
    return privateJson({ error: "伴学请求过于频繁，请稍后再试" }, 429, [cookie]);
  }

  // Defense-in-depth Consent-First validation before forwarding to coding-agent
  if (endpoint === "hint-reveal" || endpoint === "history-analyze") {
    if (body.consent_mode === "off") {
      return privateJson({ error: "当前处于隐私静默模式（off），已阻止生成提示或分析" }, 403, [cookie]);
    }
    if (body.user_consented !== true) {
      return privateJson({ error: "需要明确点击同意后才显示提示或复盘" }, 403, [cookie]);
    }
  }
  if (endpoint === "hint-reveal" && !session && body.mode === "runtime") {
    body.mode = "fast";
  }

  const slug = sanitizeCompanionUser(session?.l);
  const targetURL = `${clean(env.CODING_AGENT_URL).replace(/\/$/, "")}/api/integrations/coding-dance/v1/${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${clean(env.CODING_DANCE_API_TOKEN)}`,
    "User-Agent": "Mozilla/5.0 (compatible; CodingDanceCompanion/1.0)",
    "X-Coding-Dance-User": slug,
  };
  if (session) {
    headers["X-Coding-Dance-Tenant"] = slug;
  }

  const doFetch = opts.fetchImpl ?? fetch;
  let upstream: Response;
  try {
    upstream = await doFetch(targetURL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    return privateJson({ error: "伴学网关暂时不可达，请稍后再试" }, 502, [cookie]);
  }

  const text = await upstream.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: upstream.ok ? "伴学服务返回了无法解析的响应" : "伴学服务暂时不可用" };
  }
  return privateJson(payload, upstream.ok ? upstream.status : upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502, [cookie]);
}

/** Optional fire-and-forget async webhook delivery to coding-agent coding_dance entry point. */
export async function notifyCompanionWebhook(
  env: CompanionEnv,
  userLogin: string,
  event: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = clean(env.CODING_DANCE_WEBHOOK_URL);
  const secret = clean(env.CODING_DANCE_WEBHOOK_SECRET);
  if (!url || !secret) return;
  try {
    await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "User-Agent": "Mozilla/5.0 (compatible; CodingDanceWebhook/1.0)",
      },
      body: JSON.stringify({ user_handle: userLogin, ...event }),
    });
  } catch {
    // Non-blocking notification; never fail user progress saves
  }
}
