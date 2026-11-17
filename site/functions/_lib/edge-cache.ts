// 公共资源接口（题单、题目、专题、练习数据、题目图片）的边缘缓存：用 Workers 的 Cache API 在每个 Cloudflare 机房缓存整个响应。
// - 存进去 60 秒内直接返回，不经过 GitHub；
// - 超过 60 秒、一天以内：先返回缓存里的旧响应，同时在后台重新生成一份（stale-while-revalidate），访客不用等 GitHub；
//   所以 push 之后，一分钟后的第一次请求可能还是旧内容，紧接着的请求就是新的；
// - 只缓存 200，带 Set-Cookie 或 private / no-store 的响应一律不存；
// - 缓存键只有路径（去掉查询串、Cookie 和其他请求头），所以只能包在不看登录状态的接口外面。
//   登录用户自己的接口（session、progress、solutions、settings、sync、auth）绝不能用它。

const FRESH = 60; // 秒：这段时间内直接用缓存
const STALE = 86_400; // 秒：过期后还能先返回旧内容、后台刷新的时长
const STORED_AT = "X-Edge-Stored-At"; // 存进缓存的时间（毫秒），只在缓存副本里
const BROWSER_CC = "X-Edge-Browser-Cache-Control"; // 原来给浏览器的 Cache-Control，只在缓存副本里

interface Ctx {
  request: Request;
  waitUntil: (p: Promise<unknown>) => void;
}

// 同一个 isolate 里，同一个键同时只做一次后台刷新
const refreshing = new Set<string>();

function edgeCache(): Cache | undefined {
  return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
}

function cacheable(res: Response): boolean {
  const cc = (res.headers.get("Cache-Control") || "").toLowerCase();
  return res.status === 200 && !res.headers.has("Set-Cookie") && !cc.includes("private") && !cc.includes("no-store");
}

async function store(cache: Cache, key: Request, res: Response): Promise<void> {
  if (!cacheable(res)) return;
  const headers = new Headers(res.headers);
  headers.set(BROWSER_CC, res.headers.get("Cache-Control") || "");
  headers.set("Cache-Control", `public, s-maxage=${FRESH + STALE}`); // Cache API 按它决定保存多久
  headers.set(STORED_AT, String(Date.now()));
  await cache.put(key, new Response(res.body, { status: 200, headers }));
}

/** 给浏览器的响应：恢复原来的 Cache-Control，去掉内部头，标上 X-Edge-Cache 方便排查 */
function toClient(res: Response, status: "HIT" | "STALE" | "MISS"): Response {
  const out = new Response(res.body, res);
  const browser = out.headers.get(BROWSER_CC);
  if (browser !== null) out.headers.set("Cache-Control", browser);
  out.headers.delete(BROWSER_CC);
  out.headers.delete(STORED_AT);
  out.headers.set("X-Edge-Cache", status);
  return out;
}

/** 把一个公共 GET 接口包上边缘缓存。只用于响应不依赖 Cookie、请求头和查询串的接口。 */
export function edgeCached<C extends Ctx>(handler: (ctx: C) => Promise<Response>): (ctx: C) => Promise<Response> {
  return async (ctx) => {
    const cache = edgeCache();
    if (!cache || ctx.request.method !== "GET") return handler(ctx);
    const url = new URL(ctx.request.url);
    const key = new Request(url.origin + url.pathname, { method: "GET" });

    const hit = await cache.match(key).catch(() => undefined);
    if (hit) {
      const age = (Date.now() - Number(hit.headers.get(STORED_AT) || 0)) / 1000;
      if (age <= FRESH) return toClient(hit, "HIT");
      if (!refreshing.has(key.url)) {
        refreshing.add(key.url);
        ctx.waitUntil(
          handler(ctx)
            .then((fresh) => store(cache, key, fresh))
            .catch(() => {}) // 刷新失败就继续用旧的，下次请求再试
            .finally(() => refreshing.delete(key.url)),
        );
      }
      return toClient(hit, "STALE");
    }

    const res = await handler(ctx);
    if (cacheable(res)) ctx.waitUntil(store(cache, key, res.clone()).catch(() => {}));
    return toClient(res, "MISS");
  };
}
