// 练习区往用户进度仓写东西的队列（浏览器端）：草稿（Ctrl+S、自动保存）和「测试全部」的记录。
// - 一次只发一个请求，按先后顺序写，免得两个 commit 抢同一个分支；
// - 同一份草稿还在排队时又存了一次，只留最新的那份（合并），记录不合并；
// - 网络出错、服务端 5xx、分支刚被移动（409）都过一会儿重试，最多 3 次；没登录、参数不对这类不重试；
// - 页面关掉或切到后台时，排队的草稿用 keepalive 发出去。
// 服务端是 functions/api/progress/practice.ts，写什么文件由 lib/practice/record.ts 决定。

/** 练习区写好进度仓后发这个事件（detail: { id }），题目页的「我的历史题解」「尝试记录」会重新读 */
export const PRACTICE_SAVED_EVENT = "hot100:practice-saved";

export interface SaveResponse {
  saved: boolean;
  commit?: string;
  files?: string[];
  attempt?: string;
  solution?: string;
  draft?: string;
  status?: string;
}
export type SaveJobState =
  | { phase: "queued" | "saving" }
  | { phase: "saved"; at: number; res: SaveResponse }
  | { phase: "error"; at: number; error: string; retrying: boolean };

interface Job { key: string; body: Record<string, unknown>; coalesce: boolean; tries: number; done: ((r: SaveResponse | null) => void)[] }

const RETRY_MS = [2000, 6000, 15000];
const ENDPOINT = "/api/progress/practice";

class HttpFail extends Error {
  retry: boolean;
  constructor(message: string, retry: boolean) { super(message); this.retry = retry; }
}

async function post(body: Record<string, unknown>): Promise<SaveResponse> {
  let r: Response;
  const text = JSON.stringify(body);
  try {
    // keepalive：发出去之后页面关掉，请求也会发完（浏览器只允许 64 KB 以内的请求这么发）
    r = await fetch(ENDPOINT, { method: "POST", keepalive: text.length < 60_000, headers: { "Content-Type": "application/json" }, body: text });
  } catch {
    throw new HttpFail("网络不通", true);
  }
  const j = (await r.json().catch(() => ({}))) as SaveResponse & { error?: string };
  if (!r.ok) throw new HttpFail(j.error || `请求失败（${r.status}）`, r.status >= 500 || r.status === 409 || r.status === 429);
  return j;
}

class SaveQueue {
  private jobs: Job[] = [];
  private busy = false;
  private states = new Map<string, SaveJobState>();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** 还在排队的同一份草稿（key 相同）合并成一次，发最新的；返回这一次（或合并后那一次）的结果，失败返回 null */
  push(key: string, body: Record<string, unknown>, coalesce: boolean): Promise<SaveResponse | null> {
    return new Promise((resolve) => {
      const same = coalesce ? this.jobs.find((j) => j.coalesce && j.key === key) : undefined;
      if (same) { same.body = body; same.done.push(resolve); }
      else this.jobs.push({ key, body, coalesce, tries: 0, done: [resolve] });
      this.set(key, { phase: "queued" });
      this.kick();
    });
  }

  state(key: string) { return this.states.get(key); }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  private set(key: string, s: SaveJobState) { this.states.set(key, s); this.listeners.forEach((fn) => fn()); }

  private kick() {
    if (this.busy || this.timer || !this.jobs.length) return;
    void this.pump();
  }

  private async pump() {
    this.busy = true;
    while (this.jobs.length) {
      // 发出去的那个先从队里拿出来：之后再存的草稿另排一个，不合并进已经发出去的
      const job = this.jobs.shift()!;
      this.set(job.key, { phase: "saving" });
      try {
        const res = await post(job.body);
        if (!this.jobs.some((j) => j.key === job.key)) this.set(job.key, { phase: "saved", at: Date.now(), res });
        job.done.forEach((fn) => fn(res));
      } catch (e) {
        const err = e instanceof HttpFail ? e : new HttpFail(String(e), false);
        const retrying = err.retry && job.tries < RETRY_MS.length;
        this.set(job.key, { phase: "error", at: Date.now(), error: err.message, retrying });
        if (retrying) {
          // 排在后面的同一份草稿更新：这次就不重试了，等它的结果；否则放回队首，等一会儿再试（这段时间别的也不发，多半是同一个原因）
          const newer = job.coalesce ? this.jobs.find((j) => j.coalesce && j.key === job.key) : undefined;
          if (newer) newer.done.unshift(...job.done);
          else { job.tries++; this.jobs.unshift(job); }
          this.busy = false;
          this.timer = setTimeout(() => { this.timer = null; this.kick(); }, RETRY_MS[job.tries - 1] ?? RETRY_MS[0]);
          return;
        }
        job.done.forEach((fn) => fn(null));
      }
    }
    this.busy = false;
  }

  /**
   * 页面要关了或切到了后台：排队的全部立刻发出去（都带 keepalive），不再一个个等；正在发的那个不重复发。
   * 这时候顾不上顺序，同时写同一个分支的会有一个碰上 409，服务端会重新读一遍再写（最多三次）。
   */
  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const waiting = this.jobs; // 正在发的那个已经不在队里了
    this.jobs = [];
    for (const j of waiting) {
      this.set(j.key, { phase: "saving" });
      post(j.body).then(
        (res) => { this.set(j.key, { phase: "saved", at: Date.now(), res }); j.done.forEach((fn) => fn(res)); },
        (e) => { this.set(j.key, { phase: "error", at: Date.now(), error: e instanceof Error ? e.message : String(e), retrying: false }); j.done.forEach((fn) => fn(null)); },
      );
    }
  }
}

let queue: SaveQueue | null = null;
/** 整个页面共用一个队列（换题、切换语言都不打断还没发完的保存） */
export function practiceSaves() {
  if (!queue) queue = new SaveQueue();
  return queue;
}
