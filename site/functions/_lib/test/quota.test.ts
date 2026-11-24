// 云端运行每日额度、北京时间 0 点清零、新账号防滥用与预算开关的单元测试
// 运行：node functions/_lib/test/quota.test.ts（在 site/ 里）
import assert from "node:assert/strict";
import { type Kv, type Session } from "../session.ts";
import {
  type QuotaEnv,
  type QuotaProfile,
  beijingDay,
  clearQuotaMemory,
  consumeQuota,
  getQuotaStatus,
  nextBeijingMidnightIso,
  refundQuota,
} from "../quota.ts";

function memKv(): Kv & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async get(k) { return map.get(k) ?? null; },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
  };
}

const makeEnv = (over: Partial<QuotaEnv> = {}): QuotaEnv => ({
  TEMPLATE_REPO: "Hanwen-Jiang/hot100-progress-template",
  PROGRESS_REPO: "hot100-progress",
  SESSIONS: memKv(),
  ...over,
});

const sess = (login = "alice"): Session => ({
  t: "tok",
  l: login,
  a: "",
  exp: Date.now() + 3600_000,
});

let n = 0;
async function test(name: string, fn: () => Promise<void>) {
  clearQuotaMemory();
  await fn();
  n++;
  console.log(`ok ${n} - ${name}`);
}

await test("北京时间日期切换边界（UTC+8 0 点重置）", async () => {
  const before = Date.parse("2026-11-25T15:59:59Z"); // 2026-11-25 23:59:59 +08:00
  const after = Date.parse("2026-11-25T16:00:00Z");  // 2026-11-26 00:00:00 +08:00
  assert.equal(beijingDay(before), "2026-11-25");
  assert.equal(beijingDay(after), "2026-11-26");
  assert.equal(nextBeijingMidnightIso(before), "2026-11-26T00:00:00+08:00");
  assert.equal(nextBeijingMidnightIso(after), "2026-11-27T00:00:00+08:00");
});

await test("免费用户默认每天 30 次：第 30 次成功，第 31 次返回 429，跨天后重置", async () => {
  const env = makeEnv();
  const s = sess("freeuser");
  const profile: QuotaProfile = { tier: "free", founder: false, createdAt: "2025-01-01T00:00:00Z" };
  const day1 = Date.parse("2026-11-25T15:50:00Z");

  const init = await getQuotaStatus(env, s, { now: day1, profile });
  assert.equal(init.limit, 30);
  assert.equal(init.remaining, 30);

  for (let i = 1; i <= 30; i++) {
    const r = await consumeQuota(env, s, { now: day1, profile });
    assert.equal(r.ok, true);
    assert.equal(r.quota.used, i);
    assert.equal(r.quota.remaining, 30 - i);
  }

  const over = await consumeQuota(env, s, { now: day1, profile });
  assert.equal(over.ok, false);
  assert.equal(over.status, 429);
  assert.equal(over.code, "quota_exceeded");
  assert.equal(over.quota.remaining, 0);

  // 北京时间 0 点过后额度重置
  const day2 = Date.parse("2026-11-25T16:00:01Z");
  const r2 = await consumeQuota(env, s, { now: day2, profile });
  assert.equal(r2.ok, true);
  assert.equal(r2.quota.day, "2026-11-26");
  assert.equal(r2.quota.used, 1);
  assert.equal(r2.quota.remaining, 29);
});

await test("运行器故障退还额度（refundQuota），且不会低于 0", async () => {
  const env = makeEnv();
  const s = sess("refunduser");
  const profile: QuotaProfile = { tier: "free", founder: false, createdAt: "2025-01-01T00:00:00Z" };
  const now = Date.parse("2026-11-25T10:00:00Z");

  const r1 = await consumeQuota(env, s, { now, profile });
  assert.equal(r1.ok, true);
  assert.equal(r1.quota.used, 1);

  await refundQuota(env, s.l, r1.quota.day);
  await refundQuota(env, s.l, r1.quota.day); // 多次退还也不会变成负数

  const after = await getQuotaStatus(env, s, { now, profile });
  assert.equal(after.used, 0);
  assert.equal(after.remaining, 30);
});

await test("GitHub 注册不满 30 天的免费账号返回 403 account_too_new", async () => {
  const env = makeEnv();
  const s = sess("newbie");
  const now = Date.parse("2026-11-25T10:00:00Z");
  const young: QuotaProfile = { tier: "free", founder: false, createdAt: "2026-11-20T10:00:00Z" }; // 5 天前

  const blocked = await consumeQuota(env, s, { now, profile: young });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.code, "account_too_new");

  const oldEnough: QuotaProfile = { tier: "free", founder: false, createdAt: "2026-10-20T10:00:00Z" }; // 36 天前
  const ok = await consumeQuota(env, s, { now, profile: oldEnough });
  assert.equal(ok.ok, true);
});

await test("全站预算开关 CLOUD_FREE_PAUSED=1 暂停免费用户，但首批用户 / 专业版正常可用且每日 2000 次", async () => {
  const env = makeEnv({ CLOUD_FREE_PAUSED: "1" });
  const now = Date.parse("2026-11-25T10:00:00Z");

  const freeProfile: QuotaProfile = { tier: "free", founder: false, createdAt: "2024-01-01T00:00:00Z" };
  const freeBlocked = await consumeQuota(env, sess("freebob"), { now, profile: freeProfile });
  assert.equal(freeBlocked.ok, false);
  assert.equal(freeBlocked.status, 503);
  assert.equal(freeBlocked.code, "free_paused");

  // 首批用户（pro + founder）：即使注册时间较近且开启免费预算开关也放行，额度 2000
  const founderProfile: QuotaProfile = { tier: "pro", founder: true, createdAt: "2026-11-17T00:00:00Z" };
  const founderOk = await consumeQuota(env, sess("founder1"), { now, profile: founderProfile });
  assert.equal(founderOk.ok, true);
  assert.equal(founderOk.quota.tier, "pro");
  assert.equal(founderOk.quota.founder, true);
  assert.equal(founderOk.quota.limit, 2000);
  assert.equal(founderOk.quota.remaining, 1999);
});

console.log(`全部 ${n} 项通过`);
