// node functions/_lib/test/r2.test.ts: verifies 3-tier R2 / ASSETS / GitHub fallback loading across Edge API routes
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";

import type { Env } from "../github.ts";
import { resetR2ManifestCacheForTest } from "../r2.ts";
import { onRequestGet as getProblems } from "../../api/problems.ts";
import { onRequestGet as getProblem } from "../../api/problem/[id].ts";
import { onRequestGet as getPractice } from "../../api/practice/[id].ts";
import { onRequestGet as getTopics } from "../../api/topics.ts";
import { onRequestGet as getTopic } from "../../api/topic/[slug].ts";

const sha256Hex = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

const sampleProblemSpec = JSON.stringify({
  id: 1,
  name: "两数之和",
  level: "简单",
  topic: "哈希",
  h1: "两数之和，边走边记",
  lede: "test lede",
  handwritten: false,
  hints: [],
  codes: [],
  demo: null,
});

const samplePractice = JSON.stringify({
  id: 1,
  name: "两数之和",
  signature: { fn: "twoSum", params: ["int[]", "int"], ret: "int[]" },
  parameterNames: ["nums", "target"],
  starters: { leetcode: { python: "class Solution:\n    pass" }, acm: { python: "" } },
  legacyAcmStarterHashes: { python: "00000000" },
  cases: [],
  examples: [],
  acm: { description: "desc", input: "in", output: "out", notes: [], examples: [] },
  previousAcmStarterHashes: { python: ["00000000"] },
  previousLeetcodeStarterHashes: { python: ["00000000"] },
});

const sampleTopicsIndex = JSON.stringify([
  { slug: "prefix-sum", name: "前缀和", kind: "algo", order: 1, lede: "lede", related: [1], sections: [{ key: "prefix-sum", t: "基础", demo: false }] },
]);

const sampleTopicDetail = JSON.stringify({
  slug: "prefix-sum",
  name: "前缀和",
  kind: "algo",
  order: 1,
  lede: "lede",
  related: [1],
  sections: [{ key: "prefix-sum", t: "基础", body: [], points: [], codes: [], demo: null }],
});

const blobs: Record<string, string> = {};
const addBlob = (relPath: string, body: string) => {
  const sum = sha256Hex(body);
  const fullPath = `v1/${relPath.replace(/\.json$/, `.${sum.slice(0, 12)}.json`)}`;
  blobs[fullPath] = body;
  return { path: fullPath, sha256: sum, bytes: Buffer.byteLength(body, "utf8") };
};

const manifest = {
  version: 1,
  generatedAt: "2026-11-26T00:00:00Z",
  totalBytes: 0,
  problems: { "0001": addBlob("problems/0001.json", sampleProblemSpec) },
  practice: { "0001": addBlob("practice/0001.json", samplePractice) },
  topics: { "prefix-sum": addBlob("topics/prefix-sum.json", sampleTopicDetail) },
  topicsIndex: addBlob("topics/index.json", sampleTopicsIndex),
};
blobs["v1/manifest.json"] = JSON.stringify(manifest);

const studyPlanMd = [
  "# 热题 100",
  "## 哈希",
  "| 1 | [两数之和](../problems/0001.两数之和.md) | 简单 | |",
].join("\n");
const priorityMd = [
  "### Hot 20",
  "| 1 | 1 | [两数之和](../problems/0001.两数之和.md) |",
].join("\n");
const problemMd = "# 1. 两数之和\n\n## 题目描述\n<p>给定一个整数数组</p>\n## 思路图解\n";

function startMockGitHub(includeLegacyJson: boolean): Promise<{ server: http.Server; baseUrl: string; hits: string[] }> {
  const hits: string[] = [];
  const files: Record<string, string> = {
    "studyplan/热题100.md": studyPlanMd,
    "studyplan/优先级清单.md": priorityMd,
    "problems/0001.两数之和.md": problemMd,
  };
  if (includeLegacyJson) {
    files["tools/illustrations/data/0001.json"] = sampleProblemSpec;
    files["tools/practice/data/0001.json"] = samplePractice;
    files["tools/illustrations/data/topics/index.json"] = sampleTopicsIndex;
    files["tools/illustrations/data/topics/prefix-sum.json"] = sampleTopicDetail;
  }

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url || "/", "http://127.0.0.1").pathname);
    hits.push(urlPath);
    if (urlPath === "/repos/test/repo/git/trees/main") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ truncated: false, tree: Object.keys(files).map((p) => ({ path: p, type: "blob" })) }));
      return;
    }
    const prefix = "/repos/test/repo/contents/";
    if (urlPath.startsWith(prefix)) {
      const rel = urlPath.slice(prefix.length);
      if (rel in files) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(files[rel]);
        return;
      }
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not Found" }));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      assert(addr && typeof addr !== "string");
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}`, hits });
    });
  });
}

function startMockR2Cdn(): Promise<{ server: http.Server; baseUrl: string; hits: string[] }> {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    const clean = new URL(req.url || "/", "http://127.0.0.1").pathname.replace(/^\/r2\//, "");
    hits.push(clean);
    if (clean in blobs) {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(blobs[clean]);
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      assert(addr && typeof addr !== "string");
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}/r2`, hits });
    });
  });
}

async function exerciseAllEndpoints(env: Env, origin: string) {
  const mkCtx = (path: string, params: Record<string, string> = {}) => ({
    request: new Request(`${origin}${path}`, { method: "GET" }),
    env,
    params,
    waitUntil: () => {},
  });

  const r1 = await getProblems(mkCtx("/api/problems") as never);
  assert.equal(r1.status, 200);
  const d1 = (await r1.json()) as { problems: Array<{ id: number; hasSpec: boolean }> };
  assert.equal(d1.problems.length, 1);
  assert.equal(d1.problems[0].hasSpec, true);

  const r2 = await getProblem(mkCtx("/api/problem/1", { id: "1" }) as never);
  assert.equal(r2.status, 200);
  const d2 = (await r2.json()) as { spec: { id: number } | null; learn: Array<{ slug: string }> };
  assert.equal(d2.spec?.id, 1);
  assert.deepEqual(d2.learn.map((l) => l.slug), ["prefix-sum"]);

  const r3 = await getPractice(mkCtx("/api/practice/1", { id: "1" }) as never);
  assert.equal(r3.status, 200);
  const d3 = (await r3.json()) as { id: number; parameterNames: string[] };
  assert.equal(d3.id, 1);
  assert.deepEqual(d3.parameterNames, ["nums", "target"]);

  const r4 = await getTopics(mkCtx("/api/topics") as never);
  assert.equal(r4.status, 200);
  const d4 = (await r4.json()) as { topics: Array<{ slug: string }> };
  assert.deepEqual(d4.topics.map((t) => t.slug), ["prefix-sum"]);

  const r5 = await getTopic(mkCtx("/api/topic/prefix-sum", { slug: "prefix-sum" }) as never);
  assert.equal(r5.status, 200);
  const d5 = (await r5.json()) as { topic: { slug: string } };
  assert.equal(d5.topic.slug, "prefix-sum");
}

async function main() {
  const ghNoData = await startMockGitHub(false);
  const r2Cdn = await startMockR2Cdn();
  try {
    // Tier 1: R2_ASSETS_BASE_URL serves manifest + blobs while GitHub has ZERO derived JSONs
    resetR2ManifestCacheForTest();
    await exerciseAllEndpoints(
      {
        GITHUB_REPO: "test/repo",
        GITHUB_BRANCH: "main",
        GITHUB_API: ghNoData.baseUrl,
        R2_ASSETS_BASE_URL: r2Cdn.baseUrl,
      },
      "https://tier1.example.test",
    );
    assert(r2Cdn.hits.includes("v1/manifest.json"));
    assert(!ghNoData.hits.some((h) => h.includes("tools/")));

    // Tier 2: Cloudflare Pages static ASSETS binding (`/_r2/...`) with zero R2_ASSETS_BASE_URL and zero GitHub JSONs
    resetR2ManifestCacheForTest();
    const assetsHits: string[] = [];
    const mockAssets = {
      async fetch(input: RequestInfo | URL): Promise<Response> {
        const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
        const rel = u.pathname.replace(/^\/_r2\//, "");
        assetsHits.push(rel);
        if (rel in blobs) {
          return new Response(blobs[rel], { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response("not found", { status: 404 });
      },
    };
    await exerciseAllEndpoints(
      {
        GITHUB_REPO: "test/repo",
        GITHUB_BRANCH: "main",
        GITHUB_API: ghNoData.baseUrl,
        ASSETS: mockAssets,
      },
      "https://tier2.example.test",
    );
    assert(assetsHits.includes("v1/manifest.json"));
    assert(!ghNoData.hits.some((h) => h.includes("tools/")));

    // Tier 3: Neither R2 nor ASSETS -> fallback to GitHub `tools/*/data/*.json` (local preview compatibility)
    resetR2ManifestCacheForTest();
    const ghWithData = await startMockGitHub(true);
    try {
      await exerciseAllEndpoints(
        {
          GITHUB_REPO: "test/repo",
          GITHUB_BRANCH: "main",
          GITHUB_API: ghWithData.baseUrl,
        },
        "https://tier3.example.test",
      );
      assert(ghWithData.hits.some((h) => h.includes("tools/practice/data/0001.json")));
    } finally {
      await new Promise((r) => ghWithData.server.close(r));
    }
    console.log("Edge 3-tier R2/ASSETS/GitHub fallback verified across all 5 public API routes.");
  } finally {
    await new Promise((r) => ghNoData.server.close(r));
    await new Promise((r) => r2Cdn.server.close(r));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
