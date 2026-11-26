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

await test("上游返回通用 companion_fast 模板且带题目上下文时，升级为题目语义+代码诊断回复", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        hint_level: "L1",
        source: "companion_fast",
        title: "L1 · 方向引导问题",
        hint: "先不要看答案，检查输入为空、长度为 1 时是否成立。",
      }),
      { status: 200 },
    );

  const res = await forwardCompanion(
    postReq("/api/companion/hint-reveal", {
      consent_mode: "proactive_consent",
      user_consented: true,
      hint_level: "L1",
      problem_id: "1",
      problem_title: "两数之和",
      language: "python",
      code: "class Solution:\n    def twoSum(self, nums, target):\n        for i in range(len(nums)):\n            for j in range(len(nums)):\n                if nums[i] + nums[j] == target: return [i, j]",
      problem_context: {
        lede: "用哈希表把走过的数记下来，一遍就够了。",
        hints: [{ t: "把找一对数变成找一个数", body: "固定当前的数 x，要找 target - x" }],
        points: [{ t: "先查再存", body: "避免同一个元素使用两次" }],
      },
    }),
    makeEnv(),
    "hint-reveal",
    { fetchImpl: mockFetch },
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as { source: string; engine: string; hint: string };
  assert.equal(json.source, "context_coach");
  assert.equal(json.engine, "context_coach");
  assert.match(json.hint, /把找一对数变成找一个数/);
  assert.match(json.hint, /同一个元素重复使用两次/);
});

await test("chat 接口校验 Consent-First 并支持无 LLM 时的 ACM / 调试智能问答", async () => {
  const rDenied = await forwardCompanion(
    postReq("/api/companion/chat", { consent_mode: "on_demand", user_consented: false, question: "为什么报错？" }),
    makeEnv({ CODING_AGENT_URL: "", CODING_DANCE_API_TOKEN: "" }),
    "chat",
  );
  assert.equal(rDenied.status, 403);

  const rOk = await forwardCompanion(
    postReq("/api/companion/chat", {
      consent_mode: "on_demand",
      user_consented: true,
      mode: "acm",
      language: "python",
      problem_id: "1",
      problem_title: "两数之和",
      code: "class Solution:\n    pass",
      question: "这题 ACM 输入输出怎么写？",
      problem_context: { acm_io: "依次读取 nums（先长度 n 后元素）和 target" },
    }),
    makeEnv({ CODING_AGENT_URL: "", CODING_DANCE_API_TOKEN: "" }),
    "chat",
  );
  assert.equal(rOk.status, 200);
  const json = (await rOk.json()) as { source: string; hint: string };
  assert.equal(json.source, "context_coach");
  assert.match(json.hint, /ACM/);
  assert.match(json.hint, /stdin|标准输入/);
});

await test("配置 LLM_API_KEY 时直接走 OpenAI 兼容接口并解析结构化回复", async () => {
  let calledUrl = "";
  let calledAuth = "";
  const mockFetch: typeof fetch = async (url, init) => {
    calledUrl = String(url);
    calledAuth = (init?.headers as Record<string, string>).Authorization;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "小舞提示 · 哈希下标",
                hint: "检查第 4 行：内层循环没有跳过 `i == j`，会重复使用同一个元素。",
                next_steps: ["把内层起始下标改成 i + 1，或改用哈希表一边遍历一边存"],
                quick_replies: ["哈希表做法的时间复杂度是多少？"],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    );
  };

  const res = await forwardCompanion(
    postReq("/api/companion/chat", {
      consent_mode: "proactive_consent",
      user_consented: true,
      problem_id: "1",
      problem_title: "两数之和",
      language: "python",
      code: "for i in range(len(nums)): pass",
      question: "为什么用例 2 没过？",
    }),
    makeEnv({ LLM_API_KEY: "sk-test-key", LLM_API_BASE: "https://llm.example/v1", LLM_MODEL: "gpt-4o-mini" }),
    "chat",
    { fetchImpl: mockFetch },
  );
  assert.equal(res.status, 200);
  const json = (await res.json()) as { engine: string; title: string; hint: string };
  assert.equal(calledUrl, "https://llm.example/v1/chat/completions");
  assert.equal(calledAuth, "Bearer sk-test-key");
  assert.equal(json.engine, "llm");
  assert.match(json.hint, /i == j/);
});

await test("未配 LLM_API_KEY 但配置了 CODING_AGENT_URL 时，chat 经 coding-agent 走集群大模型并支持回退", async () => {
  let calledUrl = "";
  const mockGatewayOk: typeof fetch = async (url) => {
    calledUrl = String(url);
    return new Response(
      JSON.stringify({
        hint_level: "L2",
        source: "agent_runtime_gateway",
        engine: "llm",
        model: "a6api/deepseek-v4-flash@2026-10",
        title: "小舞点拨 · 集群模型",
        hint: "检查输入切片边界，注意空数组场景。",
        next_steps: ["补充空数组判空"],
      }),
      { status: 200 },
    );
  };

  const rOk = await forwardCompanion(
    postReq("/api/companion/chat", {
      consent_mode: "on_demand",
      user_consented: true,
      problem_id: "1",
      problem_title: "两数之和",
      language: "python",
      question: "为什么边界错了？",
    }),
    makeEnv(),
    "chat",
    { fetchImpl: mockGatewayOk },
  );
  assert.equal(rOk.status, 200);
  const okJson = (await rOk.json()) as { source: string; engine: string; hint: string };
  assert.equal(calledUrl, "https://code.cgent.link/api/integrations/coding-dance/v1/chat");
  assert.equal(okJson.source, "agent_runtime_gateway");
  assert.equal(okJson.engine, "llm");

  const mockGatewayErr: typeof fetch = async () => new Response("Not Found", { status: 404 });
  const rFallback = await forwardCompanion(
    postReq("/api/companion/chat", {
      consent_mode: "on_demand",
      user_consented: true,
      mode: "acm",
      problem_id: "1",
      problem_title: "两数之和",
      language: "python",
      question: "ACM 输入怎么读？",
      problem_context: { acm_io: "stdin 读 nums 和 target" },
    }),
    makeEnv(),
    "chat",
    { fetchImpl: mockGatewayErr },
  );
  assert.equal(rFallback.status, 200);
  const fbJson = (await rFallback.json()) as { source: string; hint: string };
  assert.equal(fbJson.source, "context_coach");
  assert.match(fbJson.hint, /ACM/);
});

console.log("全部 11 项通过");
