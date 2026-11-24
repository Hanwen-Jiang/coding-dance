// 云端运行每日额度与防滥用限制（ROADMAP 阶段 6 · 设计 4）：
//   - 免费档（free）：默认每天 30 次（CLOUD_QUOTA_FREE），要求 GitHub 账号注册满 30 天（CLOUD_MIN_ACCOUNT_DAYS）；受全站免费预算开关（CLOUD_FREE_PAUSED=1）控制。
//   - 专业档 / 首批用户（pro / founder）：默认每天 2000 次（CLOUD_QUOTA_PRO），不受新账号天数和免费预算开关限制。
//   - 按北京时间（UTC+8）0 点清零；计数存在 KV（SESSIONS）的 quota:day:<YYYY-MM-DD>:<login>（无 KV 时退回进程内存，供本地开发和测试用）。
//   - /api/session 已经读过 GitHub 的 /user、进度仓和授权时间，顺手把档位和账号注册时间缓存到 KV（quota:profile:<login>，TTL 1 小时），
//     这样 /api/run 基本零额外 GitHub 请求就能拿到完整信息。
import { type AuthEnv, type Session, membership } from "./session.ts";

export interface QuotaEnv extends AuthEnv {
  /** 免费用户每日云端运行次数，默认 30 */
  CLOUD_QUOTA_FREE?: string;
  /** 专业版 / 首批用户每日云端运行次数，默认 2000 */
  CLOUD_QUOTA_PRO?: string;
  /** 免费云端要求的 GitHub 账号最低注册天数，默认 30；设为 0 关闭该限制 */
  CLOUD_MIN_ACCOUNT_DAYS?: string;
  /** 全站月度预算开关：设为 "1" 时暂停免费用户的云端运行（首批用户 / 专业版不受影响） */
  CLOUD_FREE_PAUSED?: string;
}

export type QuotaBlockReason = "free_paused" | "account_too_new" | "quota_exceeded";

export interface QuotaProfile {
  tier: "free" | "pro";
  founder: boolean;
  createdAt: string | null;
}

export interface CloudQuota {
  tier: "free" | "pro";
  founder: boolean;
  limit: number;
  used: number;
  remaining: number;
  day: string;
  resetAt: string;
  blockedReason?: QuotaBlockReason;
}

const DAY_MS = 86_400_000;
const BJ_OFFSET_MS = 8 * 3600_000;
const PROFILE_TTL_S = 3600;
const DAY_TTL_S = 172_800; // 48 小时足够覆盖跨天与时差

/** 本地开发（未绑定 KV）或单测时的进程内存兜底 */
const memStore = new Map<string, string>();

export function clearQuotaMemory() {
  memStore.clear();
}

async function kvGet(env: AuthEnv, key: string): Promise<string | null> {
  if (env.SESSIONS) return env.SESSIONS.get(key).catch(() => null);
  return memStore.get(key) ?? null;
}

async function kvPut(env: AuthEnv, key: string, value: string, expirationTtl: number): Promise<void> {
  if (env.SESSIONS) {
    await env.SESSIONS.put(key, value, { expirationTtl }).catch(() => {});
    return;
  }
  memStore.set(key, value);
}

/** 北京时间 YYYY-MM-DD */
export function beijingDay(now = Date.now()): string {
  return new Date(now + BJ_OFFSET_MS).toISOString().slice(0, 10);
}

/** 下一次北京时间 0 点的 ISO 字符串 */
export function nextBeijingMidnightIso(now = Date.now()): string {
  const next = new Date(now + BJ_OFFSET_MS + DAY_MS).toISOString().slice(0, 10);
  return `${next}T00:00:00+08:00`;
}

function posInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

const profileKey = (login: string) => `quota:profile:${login.toLowerCase()}`;
const dayKey = (day: string, login: string) => `quota:day:${day}:${login.toLowerCase()}`;

/** 由 /api/session 调用，顺路把用户的档位和账号创建时间缓存在 KV 里 */
export async function cacheQuotaProfile(env: AuthEnv, login: string, profile: QuotaProfile): Promise<void> {
  await kvPut(env, profileKey(login), JSON.stringify(profile), PROFILE_TTL_S);
}

async function fetchProfileFromGitHub(env: AuthEnv, session: Session): Promise<QuotaProfile> {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${session.t}`,
    "User-Agent": "lc-hot100-site",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const repo = `${session.l}/${env.PROGRESS_REPO}`;
  const [meRes, repoRes, instRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers }).catch(() => null),
    fetch(`https://api.github.com/repos/${repo}`, { headers }).catch(() => null),
    fetch("https://api.github.com/user/installations?per_page=100", { headers }).catch(() => null),
  ]);
  const meJson = meRes && meRes.ok ? ((await meRes.json().catch(() => ({}))) as { created_at?: string }) : {};
  const repoJson = repoRes && repoRes.ok ? ((await repoRes.json().catch(() => ({}))) as { created_at?: string }) : {};
  const instJson = instRes && instRes.ok
    ? ((await instRes.json().catch(() => ({}))) as { installations?: { account?: { login?: string }; created_at?: string }[] })
    : {};
  const inst = (instJson.installations || []).find((i) => (i.account?.login || "").toLowerCase() === session.l.toLowerCase());
  const member = membership(env, [inst?.created_at, repoJson.created_at]);
  return {
    tier: member.tier,
    founder: member.founder,
    createdAt: typeof meJson.created_at === "string" ? meJson.created_at : null,
  };
}

/** 读取或拉取用户的档位和注册时间 */
export async function resolveQuotaProfile(
  env: QuotaEnv,
  session: Session,
  deps?: { fetchProfile?: (env: QuotaEnv, session: Session) => Promise<QuotaProfile> },
): Promise<QuotaProfile> {
  const raw = await kvGet(env, profileKey(session.l));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<QuotaProfile>;
      if (parsed && (parsed.tier === "free" || parsed.tier === "pro")) {
        return {
          tier: parsed.tier,
          founder: !!parsed.founder,
          createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : null,
        };
      }
    } catch { /* 缓存坏了就重新拉取 */ }
  }
  const profile = await (deps?.fetchProfile ? deps.fetchProfile(env, session) : fetchProfileFromGitHub(env, session));
  await cacheQuotaProfile(env, session.l, profile);
  return profile;
}

function buildQuota(
  env: QuotaEnv,
  profile: QuotaProfile,
  used: number,
  now: number,
): CloudQuota {
  const day = beijingDay(now);
  const resetAt = nextBeijingMidnightIso(now);
  const limit = profile.tier === "pro" ? posInt(env.CLOUD_QUOTA_PRO, 2000) : posInt(env.CLOUD_QUOTA_FREE, 30);
  const remaining = Math.max(0, limit - used);
  const minDays = posInt(env.CLOUD_MIN_ACCOUNT_DAYS, 30);

  let blockedReason: QuotaBlockReason | undefined;
  if (profile.tier === "free" && env.CLOUD_FREE_PAUSED === "1") {
    blockedReason = "free_paused";
  } else if (profile.tier === "free" && !profile.founder && minDays > 0 && profile.createdAt) {
    const createdMs = Date.parse(profile.createdAt);
    if (Number.isFinite(createdMs) && now - createdMs < minDays * DAY_MS) {
      blockedReason = "account_too_new";
    }
  }
  if (!blockedReason && used >= limit) {
    blockedReason = "quota_exceeded";
  }

  return {
    tier: profile.tier,
    founder: profile.founder,
    limit,
    used,
    remaining,
    day,
    resetAt,
    ...(blockedReason ? { blockedReason } : {}),
  };
}

async function readUsed(env: QuotaEnv, login: string, day: string): Promise<number> {
  const raw = await kvGet(env, dayKey(day, login));
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** 只读当前用户的云端额度状态（用于 GET /api/run） */
export async function getQuotaStatus(
  env: QuotaEnv,
  session: Session,
  opts: { now?: number; profile?: QuotaProfile; fetchProfile?: (env: QuotaEnv, session: Session) => Promise<QuotaProfile> } = {},
): Promise<CloudQuota> {
  const now = opts.now ?? Date.now();
  const profile = opts.profile ?? (await resolveQuotaProfile(env, session, { fetchProfile: opts.fetchProfile }));
  const used = await readUsed(env, session.l, beijingDay(now));
  return buildQuota(env, profile, used, now);
}

/** 扣减 1 次当日云端额度；超出或受限时返回对应 HTTP 状态码与中文提示 */
export async function consumeQuota(
  env: QuotaEnv,
  session: Session,
  opts: { now?: number; profile?: QuotaProfile; fetchProfile?: (env: QuotaEnv, session: Session) => Promise<QuotaProfile> } = {},
): Promise<
  | { ok: true; quota: CloudQuota }
  | { ok: false; status: number; code: QuotaBlockReason; error: string; quota: CloudQuota }
> {
  const now = opts.now ?? Date.now();
  const profile = opts.profile ?? (await resolveQuotaProfile(env, session, { fetchProfile: opts.fetchProfile }));
  const day = beijingDay(now);
  const used = await readUsed(env, session.l, day);
  const current = buildQuota(env, profile, used, now);

  if (current.blockedReason === "free_paused") {
    return {
      ok: false,
      status: 503,
      code: "free_paused",
      error: "免费云端运行因全站预算限制已暂时关闭，Python / JavaScript / TypeScript 可先切换回浏览器运行。",
      quota: current,
    };
  }
  if (current.blockedReason === "account_too_new") {
    const minDays = posInt(env.CLOUD_MIN_ACCOUNT_DAYS, 30);
    return {
      ok: false,
      status: 403,
      code: "account_too_new",
      error: `为防止滥用，免费云端运行要求 GitHub 账号注册满 ${minDays} 天；Python / JavaScript / TypeScript 可直接免费在浏览器里运行。`,
      quota: current,
    };
  }
  if (current.blockedReason === "quota_exceeded") {
    return {
      ok: false,
      status: 429,
      code: "quota_exceeded",
      error: `今日云端运行额度已用完（${current.used}/${current.limit} 次），北京时间 0 点自动重置；Python / JavaScript / TypeScript 可改回浏览器运行。`,
      quota: current,
    };
  }

  const nextUsed = used + 1;
  await kvPut(env, dayKey(day, session.l), String(nextUsed), DAY_TTL_S);
  const updated = buildQuota(env, profile, nextUsed, now);
  return { ok: true, quota: updated };
}

/** 运行器本身故障 / 排队满未执行时退回这一次额度 */
export async function refundQuota(env: QuotaEnv, login: string, day: string): Promise<void> {
  const used = await readUsed(env, login, day);
  if (used <= 0) return;
  await kvPut(env, dayKey(day, login), String(used - 1), DAY_TTL_S);
}
