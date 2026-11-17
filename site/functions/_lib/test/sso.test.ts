// 多域名登录（_lib/sso.ts）和令牌换新（session.ts 的 getSession）的测试：
// 模拟一个浏览器（每个域名一份 Cookie），按 302 一路跳，看每个域名最后有没有会话、票据能不能被别人拿去用。
// 运行：node functions/_lib/test/sso.test.ts（在 site/ 里）
import assert from "node:assert/strict";
import {
  type AuthEnv, type Kv, type Session, OAUTH_COOKIE, SESSION_COOKIE, getSession, readCookie, sealData, sessionCookie, unseal,
} from "../session.ts";
import {
  LINK_COOKIE, finishLogin, newSession, onAccept, onBridge, onLink, onLogout, onSignout, onSpread, needSpread, readDest, ssoOf, target, authEntry,
} from "../sso.ts";

const A = "https://a.test", B = "https://b.test", C = "https://c.test";

function memKv(): Kv & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async get(k) { return map.get(k) ?? null; },
    async put(k, v) { map.set(k, v); },
    async delete(k) { map.delete(k); },
  };
}

const baseEnv = (over: Partial<AuthEnv> = {}): AuthEnv => ({
  SESSION_SECRET: "test-secret",
  GITHUB_APP_CLIENT_ID: "cid",
  GITHUB_APP_CLIENT_SECRET: "csecret",
  GITHUB_APP_SLUG: "hot-100",
  TEMPLATE_REPO: "o/t",
  PROGRESS_REPO: "hot100-progress",
  SITE_ORIGINS: `${A}, ${B},${C}/`,
  SESSIONS: memKv(),
  ...over,
});

// —— 假的 GitHub：令牌接口和 /user ——
let ghUserStatus = 200;
const refreshCalls: string[] = [];
let refreshable = new Set<string>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === "https://api.github.com/user") return new Response(JSON.stringify({ login: "alice" }), { status: ghUserStatus });
  if (url === "https://github.com/login/oauth/access_token") {
    const body = JSON.parse(String(init?.body));
    if (body.grant_type === "refresh_token") {
      refreshCalls.push(body.refresh_token);
      if (!refreshable.has(body.refresh_token)) return new Response(JSON.stringify({ error: "bad_refresh_token" }));
      refreshable.delete(body.refresh_token); // 只能用一次
      const n = refreshCalls.length;
      refreshable.add(`r${n + 1}`);
      return new Response(JSON.stringify({ access_token: `t${n + 1}`, refresh_token: `r${n + 1}`, expires_in: 8 * 3600 }));
    }
    return new Response(JSON.stringify({ access_token: "t1", refresh_token: "r1", expires_in: 8 * 3600 }));
  }
  return realFetch(input, init);
}) as typeof fetch;

// —— 模拟浏览器 ——
class Browser {
  jars = new Map<string, Map<string, string>>();
  jar(origin: string) {
    if (!this.jars.has(origin)) this.jars.set(origin, new Map());
    return this.jars.get(origin)!;
  }
  cookieHeader(origin: string) {
    return [...this.jar(origin)].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
  }
  take(origin: string, res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(/;\s*/);
      const i = pair.indexOf("=");
      const name = pair.slice(0, i), value = decodeURIComponent(pair.slice(i + 1));
      const maxAge = attrs.find((a) => a.startsWith("Max-Age="));
      if (maxAge && Number(maxAge.slice(8)) <= 0) this.jar(origin).delete(name);
      else this.jar(origin).set(name, value);
    }
  }
  request(url: string, init: RequestInit = {}) {
    const origin = new URL(url).origin;
    const headers = new Headers(init.headers);
    const c = this.cookieHeader(origin);
    if (c) headers.set("Cookie", c);
    return new Request(url, { ...init, headers });
  }
  /** 一路跟着 302 走，直到离开我们的域名（去 GitHub）或者到了普通页面；返回走过的地址 */
  async go(url: string, env: AuthEnv, init: RequestInit = {}): Promise<string[]> {
    const trail = [url];
    let req = this.request(url, init);
    for (let hops = 0; hops < 20; hops++) {
      const u = new URL(req.url);
      const handler = routes[u.pathname];
      if (!handler || ![A, B, C].includes(u.origin)) return trail; // 普通页面或外站
      const res = await handler(req, env);
      this.take(u.origin, res);
      const loc = res.headers.get("Location");
      if (res.status !== 302 || !loc) return trail;
      const next = new URL(loc, req.url).toString();
      trail.push(next);
      req = this.request(next);
    }
    throw new Error("跳转太多次");
  }
  async session(origin: string, env: AuthEnv): Promise<Session | null> {
    const v = this.jar(origin).get(SESSION_COOKIE);
    return v ? unseal(env.SESSION_SECRET!, v) : null;
  }
}

/** Cookie 里存的会话（解码后的值） */
const cookieValue = async (env: AuthEnv, s: Session) => decodeURIComponent((await sessionCookie(env, s)).split(";")[0].slice(SESSION_COOKIE.length + 1));

/** 和 callback.ts 一样的收尾（callback.ts 本身要 import 网络相关的模块，这里只测 sso 的部分） */
async function fakeCallback(req: Request, env: AuthEnv): Promise<Response> {
  const s = await ssoOf(req, env);
  const d = readDest(req);
  const url = new URL(req.url);
  assert.ok(d && url.searchParams.get("state") === d.s, "state 要和 Cookie 对上");
  const sess = newSession(s, { t: "t1", r: "r1", te: Date.now() + 8 * 3600e3 }, "alice", "");
  return finishLogin(env, s, sess, d, [await sessionCookie(env, sess)]);
}

const routes: Record<string, (req: Request, env: AuthEnv) => Promise<Response>> = {
  "/api/auth/login": (r, e) => authEntry(r, e, "login"),
  "/api/auth/install": (r, e) => authEntry(r, e, "install"),
  "/api/auth/link": onLink,
  "/api/auth/bridge": onBridge,
  "/api/auth/accept": onAccept,
  "/api/auth/spread": onSpread,
  "/api/auth/signout": onSignout,
  "/api/auth/callback": fakeCallback,
};

/** 走到 GitHub 授权页后，假装用户点了同意：带着 state 回到登录域名的回调 */
async function approveOnGitHub(br: Browser, trail: string[], env: AuthEnv) {
  const gh = new URL(trail.at(-1)!);
  assert.equal(gh.origin, "https://github.com");
  return br.go(`${A}/api/auth/callback?code=c1&state=${gh.searchParams.get("state")}`, env);
}

let n = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  n++;
  console.log(`ok ${n} - ${name}`);
}

await test("配置：去掉空格和结尾斜杠；当前域名不在列表里就不走多域名", async () => {
  const env = baseEnv();
  const s = await ssoOf(new Request(`${B}/x`), env);
  assert.deepEqual(s?.all, [A, B, C]);
  assert.equal(s?.hub, A);
  assert.equal(await ssoOf(new Request("https://lc-hot100.pages.dev/x"), env), null);
  assert.equal(await ssoOf(new Request(`${A}/x`), baseEnv({ SITE_ORIGINS: A })), null);
});

await test("跳回地址只认列表里的域名", async () => {
  const s = (await ssoOf(new Request(`${B}/`), baseEnv()))!;
  assert.equal(target(s, "/p/1/"), `${B}/p/1/`);
  assert.equal(target(s, `${C}/p/2/?x=1#h`), `${C}/p/2/?x=1#h`);
  assert.equal(target(s, "https://evil.test/p/1/"), `${B}/`);
  assert.equal(target(s, "//evil.test/"), `${B}/`);
  assert.equal(target(s, `${C}//evil.test`), `${C}/`);
});

await test("在别的域名上点登录：经登录域名去 GitHub，回来后三个域名都登录了，回到原来的页面", async () => {
  const env = baseEnv();
  const br = new Browser();
  const t1 = await br.go(`${B}/api/auth/login?return=${encodeURIComponent("/p/1/")}`, env);
  assert.match(t1[1], /^https:\/\/a\.test\/api\/auth\/bridge\?/);
  assert.ok(t1.at(-1)!.startsWith("https://github.com/login/oauth/authorize"));
  assert.equal(new URL(t1.at(-1)!).searchParams.get("redirect_uri"), `${A}/api/auth/callback`);
  const t2 = await approveOnGitHub(br, t1, env);
  assert.equal(t2.at(-1), `${B}/p/1/`);
  const [sa, sb, sc] = await Promise.all([br.session(A, env), br.session(B, env), br.session(C, env)]);
  for (const x of [sa, sb, sc]) assert.equal(x?.l, "alice");
  assert.ok(sa!.f && sa!.f === sb!.f && sb!.f === sc!.f, "三个域名是同一次登录");
  assert.ok(sa!.lk, "登录域名记下已经同步过");
  assert.equal(sb!.lk, undefined);
  for (const o of [A, B, C]) assert.equal(br.jar(o).has(LINK_COOKIE), false, "随机数用完就清掉");
  assert.equal(br.jar(A).has(OAUTH_COOKIE), false);
});

await test("在登录域名上登录：回来后顺路同步其余域名", async () => {
  const env = baseEnv();
  const br = new Browser();
  const t1 = await br.go(`${A}/api/auth/login?return=%2Flearn%2F`, env);
  assert.ok(t1.at(-1)!.startsWith("https://github.com/"));
  const t2 = await approveOnGitHub(br, t1, env);
  assert.equal(t2.at(-1), `${A}/learn/`);
  assert.equal((await br.session(B, env))?.l, "alice");
  assert.equal((await br.session(C, env))?.l, "alice");
});

await test("登录域名已经登录：别的域名点登录不用再去 GitHub", async () => {
  const env = baseEnv();
  const br = new Browser();
  await approveOnGitHub(br, await br.go(`${A}/api/auth/login`, env), env);
  br.jar(C).clear(); // 比如用户清过 C 的 Cookie
  const t = await br.go(`${C}/api/auth/login?return=%2Fp%2F5%2F`, env);
  assert.equal(t.at(-1), `${C}/p/5/`);
  assert.ok(t.every((u) => !u.startsWith("https://github.com")));
  assert.equal((await br.session(C, env))?.l, "alice");
});

await test("登录域名的会话在 GitHub 上被撤销了：点登录时重新去 GitHub", async () => {
  const env = baseEnv();
  const br = new Browser();
  await approveOnGitHub(br, await br.go(`${A}/api/auth/login`, env), env);
  br.jar(C).clear();
  ghUserStatus = 401;
  try {
    const t = await br.go(`${C}/api/auth/login`, env);
    assert.ok(t.at(-1)!.startsWith("https://github.com/login/oauth/authorize"));
  } finally {
    ghUserStatus = 200;
  }
});

await test("票据被别的浏览器拿去用：没有对应的随机数 Cookie，不认，并提示登录失败", async () => {
  const env = baseEnv();
  const victim = new Browser(), attacker = new Browser();
  await approveOnGitHub(attacker, await attacker.go(`${A}/api/auth/login`, env), env);
  attacker.jar(B).clear();
  // 攻击者自己在 B 上点登录，截下发给 B 的票据链接（不让浏览器跟过去）
  const link = await onLink(attacker.request(`${B}/api/auth/link?mode=login&return=%2F`), env);
  attacker.take(B, link);
  const bridge = await onBridge(attacker.request(link.headers.get("Location")!), env);
  const ticketUrl = bridge.headers.get("Location")!;
  assert.match(ticketUrl, /^https:\/\/b\.test\/api\/auth\/accept\?/);
  // 骗受害者打开
  const t = await victim.go(ticketUrl, env);
  assert.equal(await victim.session(B, env), null);
  assert.match(t.at(-1)!, /login=failed/);
  // 受害者自己在 B 上发起过跳转（有自己的随机数）也一样不认
  victim.take(B, await onLink(victim.request(`${B}/api/auth/link?mode=login`), env));
  await victim.go(ticketUrl, env);
  assert.equal(await victim.session(B, env), null);
});

await test("票据只给指定域名用、过期不认、改过不认", async () => {
  const env = baseEnv();
  const br = new Browser();
  br.jar(C).set(LINK_COOKIE, "nonce1");
  const sess = newSession(null, { t: "t1" }, "alice", "");
  const forB = await sealData(env.SESSION_SECRET!, { k: "t", aud: B, n: "nonce1", x: Date.now() + 60e3, s: sess });
  await br.go(`${C}/api/auth/accept?t=${encodeURIComponent(forB)}`, env);
  assert.equal(await br.session(C, env), null, "给 B 的票据 C 不认");
  br.jar(C).set(LINK_COOKIE, "nonce1");
  const old = await sealData(env.SESSION_SECRET!, { k: "t", aud: C, n: "nonce1", x: Date.now() - 1, s: sess });
  await br.go(`${C}/api/auth/accept?t=${encodeURIComponent(old)}`, env);
  assert.equal(await br.session(C, env), null, "过期的不认");
  br.jar(C).set(LINK_COOKIE, "nonce1");
  const good = await sealData(env.SESSION_SECRET!, { k: "t", aud: C, n: "nonce1", x: Date.now() + 60e3, s: sess });
  const bad = good.slice(0, -3) + (good.endsWith("AAA") ? "BBB" : "AAA");
  await br.go(`${C}/api/auth/accept?t=${encodeURIComponent(bad)}`, env);
  assert.equal(await br.session(C, env), null, "改过的不认");
  const other = await sealData("another-secret", { k: "t", aud: C, n: "nonce1", x: Date.now() + 60e3, s: sess });
  br.jar(C).set(LINK_COOKIE, "nonce1");
  await br.go(`${C}/api/auth/accept?t=${encodeURIComponent(other)}`, env);
  assert.equal(await br.session(C, env), null, "别的密钥加密的不认");
  br.jar(C).set(LINK_COOKIE, "nonce1");
  await br.go(`${C}/api/auth/accept?t=${encodeURIComponent(good)}`, env);
  assert.equal((await br.session(C, env))?.l, "alice", "都对上了才认");
});

await test("登录域名不给列表外的域名开票据", async () => {
  const env = baseEnv();
  const br = new Browser();
  await approveOnGitHub(br, await br.go(`${A}/api/auth/login`, env), env);
  const res = await onBridge(br.request(`${A}/api/auth/bridge?aud=${encodeURIComponent("https://evil.test")}&n=x&mode=login&return=${encodeURIComponent("https://evil.test/")}`), env);
  assert.equal(res.headers.get("Location"), `${A}/`);
  // bridge 只在登录域名上
  const res2 = await onBridge(br.request(`${B}/api/auth/bridge?aud=${encodeURIComponent(B)}&n=x&mode=login`), env);
  assert.equal(res2.headers.get("Location"), "/");
});

await test("以前只在登录域名上登录过：/api/session 提示同步，同步一次后不再提示", async () => {
  const env = baseEnv();
  const br = new Browser();
  const old: Session = { t: "t1", l: "alice", a: "", exp: Date.now() + 864e5 }; // 旧会话：没有 f、lk
  br.jar(A).set(SESSION_COOKIE, await cookieValue(env, old));
  const s0 = (await br.session(A, env))!;
  assert.deepEqual(await needSpread(br.request(`${A}/`), env, s0), [B, C]);
  assert.equal(await needSpread(br.request(`${B}/`), env, s0), null, "只在登录域名上提示");
  const t = await br.go(`${A}/api/auth/spread?to=${encodeURIComponent(`${B},${C}`)}&return=%2Fp%2F3%2F`, env);
  assert.equal(t.at(-1), `${A}/p/3/`);
  const [sa, sb, sc] = await Promise.all([br.session(A, env), br.session(B, env), br.session(C, env)]);
  assert.equal(sb?.l, "alice");
  assert.equal(sc?.l, "alice");
  assert.ok(sa!.f && sa!.f === sb!.f && sa!.f === sc!.f);
  assert.equal(await needSpread(br.request(`${A}/`), env, sa!), null);
  // 连不上的域名（页面测过）不去：to 里只有 C
  const br2 = new Browser();
  br2.jar(A).set(SESSION_COOKIE, await cookieValue(env, old));
  await br2.go(`${A}/api/auth/spread?to=${encodeURIComponent(C)}`, env);
  assert.equal(await br2.session(B, env), null);
  assert.equal((await br2.session(C, env))?.l, "alice");
  assert.equal(await needSpread(br2.request(`${A}/`), env, (await br2.session(A, env))!), null, "没去成的也不再反复跳");
});

await test("退出：清掉每个域名的会话和 KV 里的令牌，回到原来的页面", async () => {
  const env = baseEnv();
  const br = new Browser();
  await approveOnGitHub(br, await br.go(`${B}/api/auth/login`, env), env);
  const f = (await br.session(B, env))!.f!;
  await env.SESSIONS!.put(`fam:${f}`, "x");
  const res = await onLogout(br.request(`${B}/api/auth/logout?return=%2Fp%2F9%2F`, { method: "POST", headers: { Origin: B } }), env);
  br.take(B, res);
  const { next } = (await res.json()) as { next: string };
  assert.match(next, /^https:\/\/a\.test\/api\/auth\/signout\?/);
  const t = await br.go(next, env);
  assert.equal(t.at(-1), `${B}/p/9/`);
  for (const o of [A, B, C]) assert.equal(await br.session(o, env), null, `${o} 也退出了`);
  assert.equal(await env.SESSIONS!.get(`fam:${f}`), null);
  // 跨站发起的退出不接受
  const res2 = await onLogout(br.request(`${B}/api/auth/logout`, { method: "POST", headers: { Origin: "https://evil.test" } }), env);
  assert.equal(res2.status, 403);
});

await test("别的网站随手放一个 signout 链接：没有 logout 发的凭证，不退出", async () => {
  const env = baseEnv();
  const br = new Browser();
  await approveOnGitHub(br, await br.go(`${A}/api/auth/login`, env), env);
  await br.go(`${C}/api/auth/signout?t=forged&return=%2F`, env);
  assert.equal((await br.session(C, env))?.l, "alice");
  const expired = await sealData(env.SESSION_SECRET!, { k: "o", x: Date.now() - 1 });
  await br.go(`${C}/api/auth/signout?t=${encodeURIComponent(expired)}`, env);
  assert.equal((await br.session(C, env))?.l, "alice");
});

await test("令牌换新：一个域名换过之后，别的域名直接用 KV 里的新令牌，不再去 GitHub 换（refresh token 只能用一次）", async () => {
  const env = baseEnv();
  refreshCalls.length = 0;
  refreshable = new Set(["r1"]);
  const soon: Session = { t: "t1", r: "r1", te: Date.now() + 60e3, l: "alice", a: "", exp: Date.now() + 864e5, f: "fam1" };
  const cookie = (await sessionCookie(env, soon)).split(";")[0];
  const reqB = new Request(`${B}/api/session`, { headers: { Cookie: cookie } });
  const reqC = new Request(`${C}/api/session`, { headers: { Cookie: cookie } });
  const gb = await getSession(reqB, env);
  assert.equal(gb.session?.t, "t2");
  assert.ok(gb.cookie);
  const gc = await getSession(reqC, env);
  assert.equal(gc.session?.t, "t2", "C 用的是 B 换来的令牌");
  assert.equal(gc.session?.r, "r2");
  assert.deepEqual(refreshCalls, ["r1"], "只去 GitHub 换了一次");
});

await test("令牌换新：两个域名同时换，没换上的那个等一下从 KV 里取", async () => {
  const kv = memKv();
  let gets = 0;
  // C 第一次看 KV 时 B 还没存进去
  const slowKv: Kv = { ...kv, async get(k) { gets++; return gets === 1 ? null : kv.get(k); }, put: kv.put, delete: kv.delete };
  const envB = baseEnv({ SESSIONS: kv }), envC = baseEnv({ SESSIONS: slowKv });
  refreshCalls.length = 0;
  refreshable = new Set(["r1"]);
  const soon: Session = { t: "t1", r: "r1", te: Date.now() + 60e3, l: "alice", a: "", exp: Date.now() + 864e5, f: "fam2" };
  const cookie = (await sessionCookie(envB, soon)).split(";")[0];
  const pc = (async () => {
    // C 先发现快过期、去 GitHub 换，但 r1 刚被 B 用掉
    await new Promise((r) => setTimeout(r, 10));
    return getSession(new Request(`${C}/x`, { headers: { Cookie: cookie } }), envC);
  })();
  const gb = await getSession(new Request(`${B}/x`, { headers: { Cookie: cookie } }), envB);
  const gc = await pc;
  assert.equal(gb.session?.t, "t2");
  assert.equal(gc.session?.t, "t2", "C 没换上，从 KV 里取到了 B 的");
  assert.deepEqual(refreshCalls, ["r1", "r1"]);
});

await test("令牌换新：没有登录编号的旧会话照旧自己换；换不上就清掉会话", async () => {
  const env = baseEnv();
  refreshable = new Set(["rx"]);
  const soon: Session = { t: "t0", r: "rx", te: Date.now() + 60e3, l: "alice", a: "", exp: Date.now() + 864e5 };
  const cookie = (await sessionCookie(env, soon)).split(";")[0];
  const g = await getSession(new Request(`${A}/x`, { headers: { Cookie: cookie } }), env);
  assert.ok(g.session && g.session.t !== "t0");
  const g2 = await getSession(new Request(`${A}/x`, { headers: { Cookie: cookie } }), env);
  assert.equal(g2.session, null);
  assert.match(g2.cookie!, /Max-Age=0/);
});

await test("只有一个域名时和以前一样：直接去 GitHub，回调地址是自己的", async () => {
  const env = baseEnv({ SITE_ORIGINS: undefined });
  const br = new Browser();
  const t = await br.go(`${B}/api/auth/login?return=%2Fp%2F1%2F`, env);
  assert.equal(t.length, 2);
  assert.equal(new URL(t[1]).searchParams.get("redirect_uri"), `${B}/api/auth/callback`);
  const d = readDest(br.request(`${B}/`))!;
  assert.equal(d.r, "/p/1/");
  const res = await finishLogin(env, null, newSession(null, { t: "t1" }, "alice", ""), d, []);
  assert.equal(res.headers.get("Location"), "/p/1/");
});

await test("上线前发出去的旧格式 OAuth Cookie 也能读", async () => {
  const d = readDest(new Request(`${A}/`, { headers: { Cookie: `${OAUTH_COOKIE}=${encodeURIComponent("st|/p/2/")}` } }));
  assert.deepEqual(d, { s: "st", r: "/p/2/" });
  assert.equal(readCookie(new Request(`${A}/`, { headers: { Cookie: "a=1" } }), OAUTH_COOKIE), null);
});

console.log(`全部 ${n} 项通过`);
