// 调用远端运行器（tools/runner，部署在 win-gw-lou 的虚拟机里，经 Cloudflare Tunnel 对外）。
// 每个请求用共享密钥 RUNNER_SECRET 签名（算法和 tools/runner/lib/sign.mjs 一样，两边要一致）；
// 运行器前面开了 Cloudflare Access 的话，再带上服务令牌 RUNNER_ACCESS_ID / RUNNER_ACCESS_SECRET。
// 这几个密钥都只放在 Pages 的加密环境变量里；RUNNER_URL 是公开的地址，写在 wrangler.toml。

export interface RunnerEnv {
  /** 运行器的地址，比如 https://run.cgent.link；不设就是还没部署 */
  RUNNER_URL?: string;
  RUNNER_SECRET?: string;
  RUNNER_ACCESS_ID?: string;
  RUNNER_ACCESS_SECRET?: string;
}

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256(body: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(body)));
}

/** 要签的内容：方法、路径、时间、随机串、用户、请求体的 SHA-256，用换行连起来 */
export function canonical(p: { method: string; path: string; time: number | string; nonce: string; user: string; bodyHash: string }): string {
  return [p.method.toUpperCase(), p.path, String(p.time), p.nonce, p.user || "", p.bodyHash].join("\n");
}

export async function sign(secret: string, p: Parameters<typeof canonical>[0]): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(canonical(p))));
}

export const runnerConfigured = (env: RunnerEnv) => !!(env.RUNNER_URL && env.RUNNER_SECRET && env.RUNNER_SECRET.length >= 32);

/** 带签名调用运行器；返回运行器的原始响应 */
export async function callRunner(env: RunnerEnv, method: "GET" | "POST", path: string, user: string, body = "", now = Date.now()): Promise<Response> {
  const time = Math.floor(now / 1000);
  const nonce = hex(crypto.getRandomValues(new Uint8Array(12)).buffer);
  const headers: Record<string, string> = {
    "x-runner-time": String(time),
    "x-runner-nonce": nonce,
    "x-runner-user": user,
    "x-runner-signature": await sign(env.RUNNER_SECRET!, { method, path, time, nonce, user, bodyHash: await sha256(body) }),
  };
  if (method === "POST") headers["content-type"] = "application/json";
  if (env.RUNNER_ACCESS_ID && env.RUNNER_ACCESS_SECRET) {
    headers["cf-access-client-id"] = env.RUNNER_ACCESS_ID;
    headers["cf-access-client-secret"] = env.RUNNER_ACCESS_SECRET;
  }
  return fetch(env.RUNNER_URL!.replace(/\/+$/, "") + path, { method, headers, body: method === "POST" ? body : undefined });
}
