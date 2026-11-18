// 网站（Cloudflare Pages Functions）调用远端运行器时的签名。网站那边的实现在 site/functions/_lib/runner.ts，两边要一致。
// 要签的内容：方法、路径、时间（Unix 秒）、随机串、用户（GitHub 登录名，没登录是空串）、请求体的 SHA-256（十六进制），用换行连起来；
// 签名 = HMAC-SHA256(共享密钥 RUNNER_SECRET, 上面的内容)，十六进制。
// 请求头：X-Runner-Time、X-Runner-Nonce、X-Runner-User、X-Runner-Signature。时间差超过 MAX_SKEW 秒、随机串用过的都拒绝（防重放）。
import crypto from "node:crypto";

export const MAX_SKEW = 120;

export const sha256 = (body) => crypto.createHash("sha256").update(body ?? "").digest("hex");

export function canonical({ method, path, time, nonce, user, bodyHash }) {
  return [String(method).toUpperCase(), path, String(time), nonce, user || "", bodyHash].join("\n");
}

export function sign(secret, parts) {
  return crypto.createHmac("sha256", secret).update(canonical(parts)).digest("hex");
}

/** 生成请求头（测试和命令行工具用；网站用的是 runner.ts 里同样的算法） */
export function signedHeaders(secret, { method, path, user = "", body = "", now = Date.now() }) {
  const time = Math.floor(now / 1000), nonce = crypto.randomBytes(12).toString("hex");
  return {
    "x-runner-time": String(time),
    "x-runner-nonce": nonce,
    "x-runner-user": user,
    "x-runner-signature": sign(secret, { method, path, time, nonce, user, bodyHash: sha256(body) }),
  };
}

/** 记用过的随机串，过期的定期清掉 */
export class NonceCache {
  constructor(ttlMs = MAX_SKEW * 2000) { this.ttl = ttlMs; this.seen = new Map(); }
  has(n) { return this.seen.has(n); }
  add(n, now = Date.now()) {
    this.seen.set(n, now + this.ttl);
    if (this.seen.size > 5000) for (const [k, t] of this.seen) if (t < now) this.seen.delete(k);
  }
}

/** 验证一个请求；返回 { ok: true, user } 或 { ok: false, reason } */
export function verify(secret, { method, path, headers, body, now = Date.now(), nonces }) {
  const h = (k) => headers[k] ?? headers[k.toLowerCase()];
  const time = Number(h("x-runner-time")), nonce = String(h("x-runner-nonce") || ""), user = String(h("x-runner-user") || ""), sig = String(h("x-runner-signature") || "");
  if (!time || !nonce || !sig) return { ok: false, reason: "缺少签名" };
  if (!/^[\w-]{16,64}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(sig) || !/^[\w.-]{0,39}$/.test(user)) return { ok: false, reason: "签名格式不对" };
  if (Math.abs(now / 1000 - time) > MAX_SKEW) return { ok: false, reason: "签名过期了（检查两边的时钟）" };
  const want = Buffer.from(sign(secret, { method, path, time, nonce, user, bodyHash: sha256(body) }), "hex");
  const got = Buffer.from(sig, "hex");
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return { ok: false, reason: "签名不对" };
  if (nonces) {
    if (nonces.has(nonce)) return { ok: false, reason: "这个请求已经用过了" };
    nonces.add(nonce, now);
  }
  return { ok: true, user };
}
