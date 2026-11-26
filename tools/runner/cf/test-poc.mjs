#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";

const BASE = (process.env.CF_POC_URL || "").replace(/\/+$/, "");
const SECRET = process.env.CF_POC_SECRET || "";
const NODE = process.env.CF_POC_NODE || "cf-poc";
const USER = process.env.CF_POC_USER || `poc-${crypto.randomBytes(3).toString("hex")}`;

if (!BASE || SECRET.length < 32) {
  console.error("Usage: CF_POC_URL=https://... CF_POC_SECRET=<32+ chars> node tools/runner/cf/test-poc.mjs");
  process.exit(1);
}

const sha256 = (b) => crypto.createHash("sha256").update(b ?? "").digest("hex");
function signReq(method, urlPath, body = "", user = USER) {
  const time = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(12).toString("hex");
  const canonical = [method.toUpperCase(), urlPath, time, nonce, user, NODE, sha256(body)].join("\n");
  const sig = crypto.createHmac("sha256", SECRET).update(canonical).digest("hex");
  return {
    time,
    nonce,
    user,
    node: NODE,
    sig,
    headers: {
      "x-runner-time": time,
      "x-runner-nonce": nonce,
      "x-runner-user": user,
      "x-runner-node": NODE,
      "x-runner-signature": sig,
    },
  };
}

async function runJob(job, retries = 8) {
  const body = JSON.stringify({ limits: { caseMs: 5000, totalMs: 30000, steps: 1000 }, ...job });
  for (let attempt = 1; ; attempt++) {
    const t0 = performance.now();
    const { headers } = signReq("POST", "/v1/run", body);
    const res = await fetch(`${BASE}/v1/run`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
      signal: AbortSignal.timeout(90000),
    });
    const wallMs = Math.round(performance.now() - t0);
    const json = await res.json().catch(() => ({}));
    if (res.status === 503 && attempt <= retries) {
      console.log(`  ⏳ ${job.lang} attempt ${attempt} got 503 (container provisioning?), retrying in 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    return { status: res.status, ok: res.ok, wallMs, json };
  }
}

const SUM_SIG = { fn: "twoSum", params: ["int[]", "int"], ret: "int[]" };
const CODE = {
  python: `class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, x in enumerate(nums):\n            if target - x in seen:\n                return [seen[target - x], i]\n            seen[x] = i\n        return []\n`,
  typescript: `function twoSum(nums: number[], target: number): number[] {\n  const seen = new Map<number, number>();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need)!, i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n`,
  java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> seen = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int need = target - nums[i];\n            if (seen.containsKey(need)) return new int[]{seen.get(need), i};\n            seen.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}\n`,
  kotlin: `class Solution {\n    fun twoSum(nums: IntArray, target: Int): IntArray {\n        val seen = HashMap<Int, Int>()\n        for (i in nums.indices) {\n            val need = target - nums[i]\n            if (seen.containsKey(need)) return intArrayOf(seen[need]!!, i)\n            seen[nums[i]] = i\n        }\n        return intArrayOf()\n    }\n}\n`,
  cpp: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int, int> seen;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            int need = target - nums[i];\n            if (seen.count(need)) return {seen[need], i};\n            seen[nums[i]] = i;\n        }\n        return {};\n    }\n};\n`,
  go: `func twoSum(nums []int, target int) []int {\n\tseen := map[int]int{}\n\tfor i, x := range nums {\n\t\tneed := target - x\n\t\tif j, ok := seen[need]; ok {\n\t\t\treturn []int{j, i}\n\t\t}\n\t\tseen[x] = i\n\t}\n\treturn nil\n}\n`,
  rust: `use std::collections::HashMap;\nimpl Solution {\n    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {\n        let mut seen = HashMap::new();\n        for (i, &x) in nums.iter().enumerate() {\n            if let Some(&j) = seen.get(&(target - x)) { return vec![j as i32, i as i32]; }\n            seen.insert(x, i);\n        }\n        vec![]\n    }\n}\n`,
};
const CASES = [{ input: [[3, 2, 4], 6] }];

async function testWebSocketDAP(lang, bpLine) {
  const s = signReq("GET", "/v1/dap", "", `${USER}-dap`);
  const wsUrl = BASE.replace(/^https:/, "wss:").replace(/^http:/, "ws:") + `/v1/dap?lang=${lang}&time=${s.time}&nonce=${s.nonce}&user=${s.user}&node=${s.node}&sig=${s.sig}`;
  const ws = new WebSocket(wsUrl);
  const queue = [];
  let wake = null;
  ws.onmessage = (ev) => {
    queue.push(JSON.parse(String(ev.data)));
    if (wake) {
      const w = wake;
      wake = null;
      w();
    }
  };
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = (e) => rej(new Error(`WS error: ${e.message || "connect failed"}`));
  });
  const waitMsg = async (pred, ms = 45000) => {
    const deadline = Date.now() + ms;
    for (;;) {
      const idx = queue.findIndex(pred);
      if (idx >= 0) return queue.splice(idx, 1)[0];
      const rem = deadline - Date.now();
      if (rem <= 0) throw new Error(`DAP timeout (${lang}), got: ${JSON.stringify(queue)}`);
      await new Promise((r) => {
        const t = setTimeout(r, rem);
        wake = () => {
          clearTimeout(t);
          r();
        };
      });
    }
  };
  const t0 = performance.now();
  ws.send(JSON.stringify({ type: "init", lang, mode: "leetcode", code: CODE[lang], sig: SUM_SIG, cases: CASES }));
  const ready = await waitMsg((m) => m.type === "ready" || m.type === "error" || m.type === "compile_error");
  assert.equal(ready.type, "ready", JSON.stringify(ready));
  ws.send(JSON.stringify({ seq: 1, type: "request", command: "initialize", arguments: { adapterID: lang } }));
  await waitMsg((m) => m.type === "response" && m.command === "initialize");
  ws.send(JSON.stringify({ seq: 2, type: "request", command: "launch", arguments: {} }));
  await waitMsg((m) => m.type === "event" && m.event === "initialized");
  ws.send(JSON.stringify({ seq: 3, type: "request", command: "setBreakpoints", arguments: { breakpoints: [{ line: bpLine }] } }));
  await waitMsg((m) => m.type === "response" && m.command === "setBreakpoints");
  ws.send(JSON.stringify({ seq: 4, type: "request", command: "configurationDone", arguments: {} }));
  const stopped = await waitMsg((m) => m.type === "event" && m.event === "stopped");
  const tid = stopped.body.threadId;
  ws.send(JSON.stringify({ seq: 5, type: "request", command: "stackTrace", arguments: { threadId: tid } }));
  const st = await waitMsg((m) => m.type === "response" && m.command === "stackTrace");
  assert.equal(st.body.stackFrames[0].line, bpLine, `DAP line mismatch for ${lang}: ${JSON.stringify(st.body.stackFrames[0])}`);
  ws.send(JSON.stringify({ seq: 6, type: "request", command: "disconnect", arguments: { terminateDebuggee: true } }));
  ws.close();
  return Math.round(performance.now() - t0);
}

const rows = [];
function record(label, r) {
  assert.equal(r.status, 200, `${label} failed (${r.status}): ${JSON.stringify(r.json)}`);
  assert.equal(r.json.compileError, undefined, r.json.compileError);
  assert.deepEqual(r.json.results?.[0]?.actual, [1, 2], JSON.stringify(r.json));
  rows.push({
    label,
    group: r.json.cfGroup,
    cold: r.json.cfColdStart,
    cfBootMs: r.json.cfContainerBootMs,
    compileMs: r.json.compileMs,
    runMs: r.json.runMs,
    totalMs: r.json.totalMs,
    wallMs: r.wallMs,
  });
}

console.log(`Testing CF Containers PoC: ${BASE} (user=${USER})`);
const h = await fetch(`${BASE}/healthz`);
assert.equal(h.status, 200);
console.log("✓ /healthz:", await h.text());

const stSig = signReq("GET", "/v1/status", "");
const st = await fetch(`${BASE}/v1/status`, { headers: stSig.headers });
assert.equal(st.status, 200);
console.log("✓ /v1/status:", await st.text());

// 1. Cold & Warm runs across all 3 container groups
record("python (cold)", await runJob({ lang: "python", mode: "leetcode", code: CODE.python, sig: SUM_SIG, cases: CASES }));
record("python (warm)", await runJob({ lang: "python", mode: "leetcode", code: CODE.python, sig: SUM_SIG, cases: CASES }));
record("typescript (warm)", await runJob({ lang: "typescript", mode: "leetcode", code: CODE.typescript, sig: SUM_SIG, cases: CASES }));

record("java (cold)", await runJob({ lang: "java", mode: "leetcode", code: CODE.java, sig: SUM_SIG, cases: CASES }));
record("java (warm)", await runJob({ lang: "java", mode: "leetcode", code: CODE.java, sig: SUM_SIG, cases: CASES }));
record("kotlin (warm)", await runJob({ lang: "kotlin", mode: "leetcode", code: CODE.kotlin, sig: SUM_SIG, cases: CASES }));

record("cpp (cold)", await runJob({ lang: "cpp", mode: "leetcode", code: CODE.cpp, sig: SUM_SIG, cases: CASES }));
record("cpp (warm)", await runJob({ lang: "cpp", mode: "leetcode", code: CODE.cpp, sig: SUM_SIG, cases: CASES }));
record("go (warm)", await runJob({ lang: "go", mode: "leetcode", code: CODE.go, sig: SUM_SIG, cases: CASES }));
record("rust (warm)", await runJob({ lang: "rust", mode: "leetcode", code: CODE.rust, sig: SUM_SIG, cases: CASES }));

console.log("\n| Case | Group | ColdStart | cfBootMs | compileMs | runMs | totalMs | clientWallMs |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) {
  console.log(`| ${r.label} | ${r.group} | ${r.cold} | ${r.cfBootMs} | ${r.compileMs} | ${r.runMs} | ${r.totalMs} | ${r.wallMs} |`);
}

// 2. ptrace / trace debug tests (C++ gdb, Go dlv, Java JdiTrace)
for (const lang of ["cpp", "go", "java"]) {
  const r = await runJob({ lang, mode: "leetcode", code: CODE[lang], sig: SUM_SIG, cases: CASES, debug: true });
  assert.equal(r.status, 200, `debug ${lang} HTTP ${r.status}: ${JSON.stringify(r.json)}`);
  const x = r.json.results?.[0];
  assert.deepEqual(x?.actual, [1, 2], `debug ${lang} error: ${x?.error || JSON.stringify(x)}`);
  assert.ok(x?.trace?.steps?.length >= 5, `debug ${lang} steps too short: ${JSON.stringify(x?.trace)}`);
  console.log(`✓ trace debug (${lang}): ${x.trace.steps.length} steps, wallMs=${r.wallMs}`);
}

// 3. WebSocket DAP tests (C++ gdb -i=dap, Go dlv dap, Java JdiDap)
for (const [lang, bp] of [["cpp", 6], ["go", 4], ["java", 5]]) {
  const ms = await testWebSocketDAP(lang, bp);
  console.log(`✓ WebSocket DAP (${lang}, bp line ${bp}): ${ms}ms`);
}

// 4. Network isolation check (enableInternet: false)
const netCode = `import socket\ntry:\n    socket.create_connection(("1.1.1.1", 53), timeout=2)\n    print("NET_OPEN")\nexcept Exception as e:\n    print("NET_BLOCKED")\n`;
const netRes = await runJob({ lang: "python", mode: "acm", code: netCode, cases: [{ stdin: "" }] });
assert.equal(netRes.status, 200);
assert.equal(netRes.json.results?.[0]?.stdout?.trim(), "NET_BLOCKED", JSON.stringify(netRes.json));
console.log("✓ enableInternet: false verified (NET_BLOCKED)");
