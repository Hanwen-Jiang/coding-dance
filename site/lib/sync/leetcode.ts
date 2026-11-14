// 力扣中国站的只读查询。transport(query, variables) 负责真正发请求：
// 网站上是让书签在用户已经登录的 leetcode.cn 页面里代发（见 bridge.ts），测试里换成假的。
import type { Detail, Sub } from "./core.ts";

const Q = {
  status: `query { userStatus { isSignedIn username userSlug } }`,
  progress: `query($filters: UserProgressQuestionListInput) { userProgressQuestionList(filters: $filters) {
    totalNum questions { frontendId titleSlug lastSubmittedAt numSubmitted questionStatus } } }`,
  list: `query($offset: Int!, $limit: Int!, $lastKey: String, $questionSlug: String!) {
    submissionList(offset: $offset, limit: $limit, lastKey: $lastKey, questionSlug: $questionSlug) {
      lastKey hasNext submissions { id status statusDisplay lang langVerboseName runtime memory timestamp isPending } } }`,
  detail: `query($id: ID!) { submissionDetail(submissionId: $id) {
    id code timestamp lang runtime memory passedTestCaseCnt totalTestCaseCnt runtimePercentile memoryPercentile } }`,
};

export type Transport = (query: string, variables: Record<string, unknown>) => Promise<any>;
export interface ProgressItem { titleSlug: string; numSubmitted: number; lastSubmittedAt?: string }

export class RateLimited extends Error {}
/** 力扣说请求太频繁了 */
export const isRateLimited = (e: unknown) => e instanceof RateLimited || /超出访问限制|访问太频繁|频繁|HTTP 429|Too Many/i.test(String((e as Error)?.message ?? e));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * gap：两次请求之间至少隔多少毫秒，别给力扣添负担；被限流一次，之后的间隔就翻倍（最多 maxGap）。
 * 被限流时先等一会儿再试，每次等的时间翻倍（默认 15、30、60、120 秒），还不行就抛 RateLimited。
 * onWait(秒数) 用来在界面上提示。
 */
export function createLeetCode(transport: Transport, { gap = 1200, maxGap = 10000, backoff = 15000, retries = 4, onWait = (_s: number) => {} } = {}) {
  let last = 0;
  const cache = new Map<string, Promise<any>>();
  async function q(query: string, variables: Record<string, unknown>, { retries: max = retries } = {}) {
    for (let k = 0; ; k++) {
      const wait = last + gap - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      try {
        return await transport(query, variables);
      } catch (e) {
        if (!isRateLimited(e)) throw e;
        if (max > 0) gap = Math.min(gap * 2, maxGap); // 只试一次的查询（「做过的题」）被拒不影响别的查询的节奏
        if (k >= max) throw new RateLimited("力扣一直提示请求太频繁");
        const ms = backoff * 2 ** k;
        onWait(Math.round(ms / 1000));
        await sleep(ms);
      }
    }
  }
  const memo = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    if (!cache.has(key)) cache.set(key, fn().catch((e) => { cache.delete(key); throw e; }));
    return cache.get(key)!;
  };
  return {
    status: async (): Promise<{ isSignedIn: boolean; username: string }> => (await q(Q.status, {})).userStatus,
    /** 做过的所有题（有提交记录的）。这个接口力扣限流很严，被限流时不等，直接抛出，调用方改成逐题查 */
    progress: () => memo("progress", async () => {
      const out: ProgressItem[] = [];
      for (let skip = 0; ; skip += 100) {
        const p = (await q(Q.progress, { filters: { skip, limit: 100 } }, { retries: 0 })).userProgressQuestionList;
        if (!p) throw new Error("读不到力扣的做题记录：确认已经登录 leetcode.cn");
        out.push(...p.questions);
        if (!p.questions.length || skip + 100 >= p.totalNum) return out;
      }
    }),
    /** 一道题的所有提交，最新的在前 */
    submissions: (slug: string) => memo(`list:${slug}`, async () => {
      const out: Sub[] = [];
      let lastKey: string | null = null;
      for (let offset = 0; offset < 2000; offset += 20) {
        const l: { submissions: Sub[]; lastKey: string | null; hasNext: boolean } = (await q(Q.list, { offset, limit: 20, lastKey, questionSlug: slug })).submissionList;
        out.push(...l.submissions);
        lastKey = l.lastKey;
        if (!l.hasNext) break;
      }
      return out;
    }),
    detail: (id: string | number) => memo(`detail:${id}`, async (): Promise<Detail> => (await q(Q.detail, { id: String(id) })).submissionDetail),
  };
}
export type LeetCode = ReturnType<typeof createLeetCode>;

/** 把页面里代发请求的结果变成 data，出错时抛异常 */
export function unwrap(res: { status: number; json?: any; text?: string } | null | undefined) {
  if (!res) throw new Error("力扣页面没有返回结果");
  if (!res.json) throw new Error(`力扣返回了 HTTP ${res.status}：${res.text || ""}`);
  if (res.json.errors?.length) throw new Error("力扣：" + res.json.errors.map((e: { message: string }) => e.message).join("；"));
  return res.json.data;
}
