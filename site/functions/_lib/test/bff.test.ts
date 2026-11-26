// node functions/_lib/test/bff.test.ts：Edge BFF 代理 ⇄ 真实 Go cd-api 二进制（OAuth 登录/回调/会话 + 冷启动 GitHub 回填 + 热存储写入 + 退出）端到端测试
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { onRequest } from "../../api/_middleware.ts";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cd-bff-test-"));
const cdApiBin = path.join(tmpDir, process.platform === "win32" ? "cd-api.exe" : "cd-api");

const gitBlobSha = (content: string) => {
  const buf = Buffer.from(content, "utf8");
  return crypto.createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
};

const reservePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") return reject(new Error("unexpected address"));
      const { port } = addr;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });

const sendJson = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const files: Record<string, string> = {
  "progress.json": JSON.stringify({ version: 1, problems: { "1": { status: "曾通过", updatedAt: "2026-11-10" } } }),
  "settings.json": JSON.stringify({ version: 1, langs: ["python", "go"] }),
  "solutions/python/0001.两数之和.py": "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]\n",
};
const headSHA = "1".repeat(40);
const treeSHA = "2".repeat(40);

const mockGh = http.createServer((req, res) => {
  const u = new URL(req.url || "/", "http://127.0.0.1");
  const p = u.pathname;
  if (req.method === "POST" && p === "/login/oauth/access_token") {
    return sendJson(res, 200, { access_token: "ghu_bff_token", refresh_token: "ghr_bff_token", expires_in: 28800 });
  }
  if (req.method === "GET" && p === "/user") {
    return sendJson(res, 200, { login: "octocat", avatar_url: "https://avatars.example/octo.png", created_at: "2020-01-01T00:00:00Z" });
  }
  if (req.method === "GET" && p === "/user/installations") {
    return sendJson(res, 200, {
      installations: [
        {
          id: 77,
          account: { login: "octocat" },
          repository_selection: "all",
          permissions: { repository_creation: "write" },
          created_at: "2026-11-01T00:00:00Z",
        },
      ],
    });
  }
  if (req.method === "GET" && p.startsWith("/user/starred/")) {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && p === "/repos/octocat/hot100-progress") {
    return sendJson(res, 200, { default_branch: "main", created_at: "2026-11-01T00:00:00Z" });
  }
  if (req.method === "GET" && p === "/repos/octocat/hot100-progress/git/ref/heads/main") {
    return sendJson(res, 200, { object: { sha: headSHA } });
  }
  if (req.method === "GET" && p.startsWith("/repos/octocat/hot100-progress/git/commits/")) {
    return sendJson(res, 200, { tree: { sha: treeSHA } });
  }
  if (req.method === "GET" && p.startsWith("/repos/octocat/hot100-progress/git/trees/")) {
    return sendJson(res, 200, {
      truncated: false,
      tree: Object.entries(files).map(([filePath, content]) => ({
        path: filePath,
        type: "blob",
        sha: gitBlobSha(content),
      })),
    });
  }
  if (req.method === "GET" && p.startsWith("/repos/octocat/hot100-progress/git/blobs/")) {
    const sha = p.slice("/repos/octocat/hot100-progress/git/blobs/".length);
    const matched = Object.values(files).find((content) => gitBlobSha(content) === sha);
    if (!matched) return sendJson(res, 404, { message: "blob not found" });
    return sendJson(res, 200, { encoding: "base64", content: Buffer.from(matched, "utf8").toString("base64") });
  }
  if (req.method === "POST" && p === "/repos/octocat/hot100-progress/git/trees") {
    return sendJson(res, 201, { sha: "3".repeat(40) });
  }
  if (req.method === "POST" && p === "/repos/octocat/hot100-progress/git/commits") {
    return sendJson(res, 201, { sha: "4".repeat(40) });
  }
  if (req.method === "PATCH" && p === "/repos/octocat/hot100-progress/git/refs/heads/main") {
    return sendJson(res, 200, { object: { sha: "4".repeat(40) } });
  }
  sendJson(res, 404, { message: `unexpected mock GitHub request: ${req.method} ${p}` });
});

let child: ReturnType<typeof spawn> | null = null;

try {
  execFileSync("go", ["build", "-o", cdApiBin, "./cmd/cd-api"], { cwd: repoRoot, stdio: "inherit" });
  await new Promise<void>((resolve) => mockGh.listen(0, "127.0.0.1", resolve));
  const ghAddr = mockGh.address();
  assert.ok(ghAddr && typeof ghAddr !== "string");
  const mockGhUrl = `http://127.0.0.1:${ghAddr.port}`;
  const apiPort = await reservePort();
  const upstream = `http://127.0.0.1:${apiPort}`;

  child = spawn(cdApiBin, [], {
    cwd: repoRoot,
    env: {
      ...process.env,
      API_HOST: "127.0.0.1",
      API_PORT: String(apiPort),
      SESSION_SECRET: "edge-bff-test-session-secret-0123456789",
      GITHUB_APP_CLIENT_ID: "iv1.edgebff",
      GITHUB_APP_CLIENT_SECRET: "edgebff-secret",
      GITHUB_APP_SLUG: "coding-dance",
      GITHUB_OAUTH_BASE: mockGhUrl,
      SYNC_GITHUB_API: mockGhUrl,
      SITE_ORIGINS: "https://codingdance.cn,https://codexdance.cn",
      PROBLEMS_DIR: path.join(repoRoot, "problems"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${upstream}/healthz`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      /* waiting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, "cd-api should start and respond on /healthz");

  let nextCalls = 0;
  const passthroughNext = async () => {
    nextCalls++;
    return new Response("edge-next", { status: 200 });
  };
  const callEdge = (reqUrl: string, init: RequestInit, env: Record<string, string | undefined>) =>
    onRequest({ request: new Request(reqUrl, init), env, next: passthroughNext });

  let passed = 0;
  const test = async (name: string, fn: () => Promise<void>) => {
    await fn();
    passed++;
    console.log(`ok ${passed} - ${name}`);
  };

  await test("未配置 CD_API_UPSTREAM 时 /api/session 返回游客降级态，非 BFF 路由透传 next()", async () => {
    const rSess = await callEdge("https://codingdance.cn/api/session", { method: "GET" }, {});
    assert.equal(rSess.status, 200);
    const j = (await rSess.json()) as { configured: boolean; user: unknown };
    assert.equal(j.configured, false);
    assert.equal(j.user, null);

    const rProg = await callEdge("https://codingdance.cn/api/progress", { method: "GET" }, {});
    assert.equal(rProg.status, 503);

    const beforeNext = nextCalls;
    const rProblems = await callEdge("https://codingdance.cn/api/problems", { method: "GET" }, {});
    assert.equal(rProblems.status, 200);
    assert.equal(await rProblems.text(), "edge-next");
    assert.equal(nextCalls, beforeNext + 1);
  });

  const cookieMap = new Map<string, string>();
  const storeSetCookies = (res: Response) => {
    const getSetCookie = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const list = typeof getSetCookie === "function" ? getSetCookie.call(res.headers) : [];
    for (const raw of list) {
      const first = raw.split(";")[0];
      const idx = first.indexOf("=");
      if (idx > 0) {
        const k = first.slice(0, idx);
        const v = first.slice(idx + 1);
        if (v) cookieMap.set(k, v);
        else cookieMap.delete(k);
      }
    }
  };
  const cookieHeader = () =>
    Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

  await test("Edge 代理 OAuth /api/auth/login -> /api/auth/callback 并完整保留多条 Set-Cookie", async () => {
    const env = { CD_API_UPSTREAM: upstream };
    const loginRes = await callEdge("https://codingdance.cn/api/auth/login?return=%2Fp%2F1%2F", { method: "GET" }, env);
    assert.equal(loginRes.status, 302);
    const authLoc = loginRes.headers.get("Location") || "";
    assert.ok(authLoc.startsWith(`${mockGhUrl}/login/oauth/authorize`), `unexpected authorize redirect: ${authLoc}`);
    const authUrl = new URL(authLoc);
    assert.equal(authUrl.searchParams.get("redirect_uri"), "https://codingdance.cn/api/auth/callback");
    const state = authUrl.searchParams.get("state");
    assert.ok(state);
    storeSetCookies(loginRes);
    assert.ok(cookieMap.has("hot100_oauth"));

    const cbRes = await callEdge(
      `https://codingdance.cn/api/auth/callback?code=ok_code&state=${encodeURIComponent(state)}`,
      { method: "GET", headers: { Cookie: cookieHeader() } },
      env,
    );
    assert.equal(cbRes.status, 302);
    assert.equal(cbRes.headers.get("Location"), "/p/1/");
    storeSetCookies(cbRes);
    assert.ok(!cookieMap.has("hot100_oauth"), "callback must clear hot100_oauth");
    assert.ok(cookieMap.has("hot100_session"), "callback must set hot100_session");
  });

  await test("已登录态经 Edge BFF 访问 /api/session、冷启动 /api/progress、/api/solutions/1 与热写草稿", async () => {
    const env = { CD_API_UPSTREAM: upstream };
    const sessRes = await callEdge("https://codingdance.cn/api/session", { method: "GET", headers: { Cookie: cookieHeader() } }, env);
    assert.equal(sessRes.status, 200);
    const sess = (await sessRes.json()) as { user: { login: string }; member: { founder: boolean }; repo: { accessible: boolean } };
    assert.equal(sess.user.login, "octocat");
    assert.equal(sess.member.founder, true);
    assert.equal(sess.repo.accessible, true);

    const progRes = await callEdge("https://codingdance.cn/api/progress", { method: "GET", headers: { Cookie: cookieHeader() } }, env);
    assert.equal(progRes.status, 200);
    const prog = (await progRes.json()) as { status: Record<string, string>; settings?: { langs: string[] } };
    assert.equal(prog.status["1"], "曾通过");
    assert.deepEqual(prog.settings?.langs, ["python", "go"]);

    const solRes = await callEdge("https://codingdance.cn/api/solutions/1", { method: "GET", headers: { Cookie: cookieHeader() } }, env);
    assert.equal(solRes.status, 200);
    const sol = (await solRes.json()) as { history: { lang: string; code: string }[] };
    assert.equal(sol.history.length, 1);
    assert.equal(sol.history[0].lang, "python");

    const saveRes = await callEdge(
      "https://codingdance.cn/api/progress/practice",
      {
        method: "POST",
        headers: {
          Cookie: cookieHeader(),
          Origin: "https://codingdance.cn",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kind: "draft", id: 1, lang: "go", mode: "leetcode", code: "func twoSum() []int { return []int{0,1} }" }),
      },
      env,
    );
    assert.equal(saveRes.status, 200);
    const saved = (await saveRes.json()) as { saved: boolean; draft: string };
    assert.equal(saved.saved, true);
    assert.equal(saved.draft, "drafts/go/0001.两数之和.go");

    const getDraftRes = await callEdge(
      "https://codingdance.cn/api/progress/practice?id=1&lang=go&mode=leetcode",
      { method: "GET", headers: { Cookie: cookieHeader() } },
      env,
    );
    assert.equal(getDraftRes.status, 200);
    const draft = (await getDraftRes.json()) as { code: string };
    assert.ok(draft.code.includes("func twoSum()"));

    const logoutRes = await callEdge(
      "https://codingdance.cn/api/auth/logout",
      { method: "POST", headers: { Cookie: cookieHeader(), Origin: "https://codingdance.cn" } },
      env,
    );
    assert.equal(logoutRes.status, 200);
    storeSetCookies(logoutRes);
    assert.ok(!cookieMap.has("hot100_session"), "logout must clear hot100_session");
  });

  await test("EdgeOne 代理回源 lc-hot100.pages.dev 时识别 X-Forwarded-Host / X-Edge-Origin-Host 并校验 EDGE_PROXY_KEY", async () => {
    const baseEnv = {
      CD_API_UPSTREAM: upstream,
      SITE_ORIGINS: "https://codingdance.cn,https://codexdance.cn",
    };

    const rXf = await callEdge(
      "https://lc-hot100.pages.dev/api/auth/login?return=%2Fp%2F1%2F",
      { method: "GET", headers: { "X-Forwarded-Host": "codingdance.cn" } },
      baseEnv,
    );
    assert.equal(rXf.status, 302);
    const uXf = new URL(rXf.headers.get("Location") || "");
    assert.equal(uXf.searchParams.get("redirect_uri"), "https://codingdance.cn/api/auth/callback");

    const rEvil = await callEdge(
      "https://lc-hot100.pages.dev/api/auth/login?return=%2Fp%2F1%2F",
      { method: "GET", headers: { "X-Forwarded-Host": "evil.example" } },
      baseEnv,
    );
    assert.equal(rEvil.status, 302);
    const uEvil = new URL(rEvil.headers.get("Location") || "");
    assert.equal(uEvil.searchParams.get("redirect_uri"), `https://127.0.0.1:${apiPort}/api/auth/callback`);

    const keyedEnv = { ...baseEnv, EDGE_PROXY_KEY: "edge-secret-key" };
    const rBadKey = await callEdge(
      "https://lc-hot100.pages.dev/api/auth/login?return=%2Fp%2F1%2F",
      { method: "GET", headers: { "X-Edge-Origin-Host": "codingdance.cn", "X-Edge-Proxy-Key": "wrong" } },
      keyedEnv,
    );
    assert.equal(new URL(rBadKey.headers.get("Location") || "").searchParams.get("redirect_uri"), `https://127.0.0.1:${apiPort}/api/auth/callback`);

    const rGoodKey = await callEdge(
      "https://lc-hot100.pages.dev/api/auth/login?return=%2Fp%2F1%2F",
      { method: "GET", headers: { "X-Edge-Origin-Host": "codingdance.cn", "X-Edge-Proxy-Key": "edge-secret-key" } },
      keyedEnv,
    );
    assert.equal(new URL(rGoodKey.headers.get("Location") || "").searchParams.get("redirect_uri"), "https://codingdance.cn/api/auth/callback");
  });

  console.log(`\n${passed} 项全部通过`);
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 200));
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
  mockGh.closeAllConnections?.();
  await new Promise((resolve) => mockGh.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
