// 通过 GitHub API 读取仓库。令牌只在服务端使用（Pages 的加密环境变量 GITHUB_TOKEN），不会出现在任何响应里。

export interface Env {
  /** 读私有仓库用的 GitHub 令牌，用 `wrangler pages secret put GITHUB_TOKEN` 设置；仓库公开后可以不设 */
  GITHUB_TOKEN?: string;
  /** owner/name */
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  /** 本地调试时可以指向一个模拟的 API 地址 */
  GITHUB_API?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// isolate 内的短期缓存：同一个 isolate 处理的请求共享，避免每次都打 GitHub。
// 只缓存已经拿到的结果，不缓存还在进行中的 Promise：Workers 里一个请求创建的 Promise 不能在别的请求里等，
// 发起它的请求先结束（比如访客关掉了页面）的话，别的请求会一直拿到「request that has since ended」的 500。
const TTL = 60_000;
const memo = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await load(); // 失败时直接抛出，不缓存
  memo.set(key, { at: Date.now(), value });
  return value;
}

const base = (env: Env) => (env.GITHUB_API || "https://api.github.com").replace(/\/$/, "");
const encPath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

function headers(env: Env, accept: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: accept,
    "User-Agent": "lc-hot100-site",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = env.GITHUB_TOKEN?.trim(); // 通过管道写入 secret 时末尾可能带换行
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** 仓库里所有文件的路径 */
export function listFiles(env: Env): Promise<string[]> {
  return cached("tree", async () => {
    const url = `${base(env)}/repos/${env.GITHUB_REPO}/git/trees/${encodeURIComponent(env.GITHUB_BRANCH)}?recursive=1`;
    const r = await fetch(url, { headers: headers(env, "application/vnd.github+json") });
    if (!r.ok) throw new HttpError(502, `读取仓库目录失败（GitHub ${r.status}）`);
    const j = (await r.json()) as { tree: { path: string; type: string }[] };
    return j.tree.filter((e) => e.type === "blob").map((e) => e.path);
  });
}

function fetchRaw(env: Env, path: string): Promise<Response> {
  const url = `${base(env)}/repos/${env.GITHUB_REPO}/contents/${encPath(path)}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`;
  return fetch(url, { headers: headers(env, "application/vnd.github.raw+json") });
}

/** 读一个文本文件，不存在时返回 null */
export function readText(env: Env, path: string): Promise<string | null> {
  return cached("text:" + path, async () => {
    const r = await fetchRaw(env, path);
    if (r.status === 404) return null;
    if (!r.ok) throw new HttpError(502, `读取 ${path} 失败（GitHub ${r.status}）`);
    return r.text();
  });
}

/** 读一个二进制文件，不存在时返回 null */
export async function readBytes(env: Env, path: string): Promise<ArrayBuffer | null> {
  const r = await fetchRaw(env, path);
  if (r.status === 404) return null;
  if (!r.ok) throw new HttpError(502, `读取 ${path} 失败（GitHub ${r.status}）`);
  return r.arrayBuffer();
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=30" : "no-store",
    },
  });
}

export function fail(e: unknown): Response {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : String(e);
  return json({ error: message }, status);
}
