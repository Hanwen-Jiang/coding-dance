import assert from "node:assert/strict";
import {
  type CompanionEnv,
  clearCompanionRateMemory,
  companionConfigured,
  forwardCompanion,
  sanitizeCompanionUser,
} from "../companion.ts";
import { SESSION_COOKIE, seal } from "../session.ts";

const makeEnv = (over: Partial<CompanionEnv> = {}): CompanionEnv => ({
  TEMPLATE_REPO: "Hanwen-Jiang/hot100-progress-template",
  PROGRESS_REPO: "hot100-progress",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  CODING_AGENT_URL: "https://code.cgent.link",
  CODING_DANCE_API_TOKEN: "cd-secret-token",
  ...over,
});

const postReq = (path: string, body: unknown, opts: { origin?: string | null; cookie?: string; ip?: string } = {}) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.origin !== null) headers.Origin = opts.origin ?? "https://codingdance.cn";
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.ip) headers["CF-Connecting-IP"] = opts.ip;
  return new Request(`https://codingdance.cn${path}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
};

let n = 0;
async function test(name: string, fn: () => Promise<void>) {
  clearCompanionRateMemory();
  await fn();
  n++;
  console.log(`ok ${n} - ${name}`);
}

await test("sanitizeCompanionUser 规范化大小写并限制长度", async () => {
  assert.equal(sanitizeCompanionUser("Hanwen-Jiang"), "gh-hanwen-jiang");
  assert.equal(sanitizeCompanionUser("Alice.Bob"), "gh-alice-bob");
  assert.equal(sanitizeCompanionUser(""), "guest");
  assert.equal(sanitizeCompanionUser(null), "guest");
  assert.ok(/^[a-z0-9][a-z0-9_-]{0,62}$/.test(sanitizeCompanionUser("X".repeat(100))));
});

await test("拒绝跨站请求（403）与未配置服务端环境变量（503）", async () => {
  const rCross = await forwardCompanion(
    postReq("/api/companion/hint-check", { problem_id: "0001" }, { origin: "https://evil.example" }),
    makeEnv(),
    "hint-check",
  );
  assert.equal(rCross.status, 403);

  const rUnconf = await forwardCompanion(
    postReq("/api/companion/hint-check", { problem_id: "0001" }),
    makeEnv({ CODING_DANCE_API_TOKEN: "" }),
    "hint-check",
  );
  assert.equal(rUnconf.status, 503);
  assert.equal(companionConfigured(makeEnv()), true);
});

await test("hint-check 透传认证头、Browser UA 与防剧透响应", async () => {
  let seenAuth = "";
  let seenUA = "";
  let seenUser = "";
  const mockFetch: typeof fetch = async (_url, init) => {
    const h = init?.headers as Record<string, string>;
    seenAuth = h.Authorization;
    seenUA = h["User-Agent"];
    seenUser = h["X-Coding-Dance-User"];
    return new Response(JSON.stringify({
      consent_mode: "proactive_consent",
      action: "ask_consent",
      should_prompt: true,
      spoiler_free: true,
      consent_token: "1764000000.sig",
      prompt_text: "要不要一个不剧透的小提示？",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const res = await forwardCompanion(
    postReq("/api/companion/hint-check", { consent_mode: "proactive_consent", problem_id: "0001", attempt_count: 2 }),
    makeEnv(),
    "hint-check",
    { fetchImpl: mockFetch },
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as Record<string, unknown>;
  assert.equal(json.spoiler_free, true);
  assert.equal(seenAuth, "Bearer cd-secret-token");
  assert.ok(seenUA.startsWith("Mozilla/5.0"));
  assert.equal(seenUser, "guest");
});

await test("hint-reveal 在边缘侧强制 Consent-First：未同意/off 一律 403，同意后透传", async () => {
  let called = false;
  const mockFetch: typeof fetch = async () => {
    called = true;
    return new Response(JSON.stringify({ hint_level: "L1", title: "方向提示", hint: "检查哈希表存什么" }), { status: 200 });
  };

  const rDenied = await forwardCompanion(
    postReq("/api/companion/hint-reveal", { consent_mode: "proactive_consent", user_consented: false, hint_level: "L1" }),
    makeEnv(),
    "hint-reveal",
    { fetchImpl: mockFetch },
  );
  assert.equal(rDenied.status, 403);
  assert.equal(called, false);

  const rOff = await forwardCompanion(
    postReq("/api/companion/hint-reveal", { consent_mode: "off", user_consented: true, hint_level: "L1" }),
    makeEnv(),
    "hint-reveal",
    { fetchImpl: mockFetch },
  );
  assert.equal(rOff.status, 403);
  assert.equal(called, false);

  const rOk = await forwardCompanion(
    postReq("/api/companion/hint-reveal", { consent_mode: "proactive_consent", user_consented: true, hint_level: "L1", problem_id: "0001" }),
    makeEnv(),
    "hint-reveal",
    { fetchImpl: mockFetch },
  );
  assert.equal(rOk.status, 200);
  assert.equal(called, true);
});

await test("history-analyze 强制登录（未登录 401，登录后带租户 slug 200）", async () => {
  const env = makeEnv();
  const rUnauth = await forwardCompanion(
    postReq("/api/companion/history-analyze", { user_consented: true, submissions: [] }),
    env,
    "history-analyze",
    { requireAuth: true },
  );
  assert.equal(rUnauth.status, 401);

  const sealed = await seal(env.SESSION_SECRET!, {
    t: "ghu_test",
    l: "Hanwen-Jiang",
    a: "",
    exp: Date.now() + 3600_000,
  });
  let seenTenant = "";
  const mockFetch: typeof fetch = async (_u, init) => {
    seenTenant = (init?.headers as Record<string, string>)["X-Coding-Dance-Tenant"];
    return new Response(JSON.stringify({ summary: { total_submissions: 1 }, recommendations: ["多练边界"] }), { status: 200 });
  };

  const rAuth = await forwardCompanion(
    postReq("/api/companion/history-analyze", { user_consented: true, submissions: [{ status: "wrong_answer" }] }, { cookie: `${SESSION_COOKIE}=${encodeURIComponent(sealed)}` }),
    env,
    "history-analyze",
    { requireAuth: true, fetchImpl: mockFetch },
  );
  assert.equal(rAuth.status, 200);
  assert.equal(seenTenant, "gh-hanwen-jiang");
});

await test("超过每分钟限流返回 429", async () => {
  const env = makeEnv();
  const mockFetch: typeof fetch = async () => new Response(JSON.stringify({ action: "silent" }), { status: 200 });
  for (let i = 0; i < 30; i++) {
    const r = await forwardCompanion(
      postReq("/api/companion/hint-check", { problem_id: "0001" }, { ip: "1.2.3.4" }),
      env,
      "hint-check",
      { fetchImpl: mockFetch, now: 1_764_000_000_000 + i },
    );
    assert.equal(r.status, 200);
  }
  const rBlocked = await forwardCompanion(
    postReq("/api/companion/hint-check", { problem_id: "0001" }, { ip: "1.2.3.4" }),
    env,
    "hint-check",
    { fetchImpl: mockFetch, now: 1_764_000_000_500 },
  );
  assert.equal(rBlocked.status, 429);
});

await test("EdgeOne 反向代理回源 lc-hot100.pages.dev 时允许 SITE_ORIGINS 发起写请求，仍拦截未知 Origin", async () => {
  const env = makeEnv({ SITE_ORIGINS: "https://codingdance.cn,https://codexdance.cn" });
  const mockFetch: typeof fetch = async () => new Response(JSON.stringify({ action: "silent" }), { status: 200 });

  const reqOk = new Request("https://lc-hot100.pages.dev/api/companion/hint-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://codingdance.cn" },
    body: JSON.stringify({ problem_id: "0001" }),
  });
  const rOk = await forwardCompanion(reqOk, env, "hint-check", { fetchImpl: mockFetch });
  assert.equal(rOk.status, 200);

  const reqEvil = new Request("https://lc-hot100.pages.dev/api/companion/hint-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ problem_id: "0001" }),
  });
  const rEvil = await forwardCompanion(reqEvil, env, "hint-check", { fetchImpl: mockFetch });
  assert.equal(rEvil.status, 403);
});

console.log("全部 7 项通过");
