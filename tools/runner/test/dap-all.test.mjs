import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { compile } = require("../sandbox/toolchain");
const { leetcodeProgram, acmProgram } = require("../sandbox/programs");

const DAP_SESSION = path.resolve("tools/runner/sandbox/dap-session.js");

function hasCmd(cmd, args = ["--version"]) {
  try {
    return cp.spawnSync(cmd, args, { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

async function runLiveDapTest(spec, { bpLine, expectStackLine, expectVarName, expectVarSubstr, evalExpr, expectEvalSubstr, expectStepLine, expectStdoutSubstr }) {
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), `dap-test-${spec.lang}-`));
  const child = cp.spawn(process.execPath, [DAP_SESSION, "stdio"], {
    env: { ...process.env, RUNNER_WORK: workRoot },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderrBuf = "";
  child.stderr.on("data", (d) => { stderrBuf += d.toString("utf8"); });

  let seq = 1;
  let buf = Buffer.alloc(0);
  let headerSeen = false;
  const msgs = [];
  const waiters = [];

  const notify = () => {
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      const idx = msgs.findIndex(w.pred);
      if (idx >= 0) {
        waiters.splice(i, 1);
        w.resolve(msgs[idx]);
      }
    }
  };

  let initHeaderResolve, initHeaderReject;
  const initHeaderPromise = new Promise((res, rej) => { initHeaderResolve = res; initHeaderReject = rej; });

  child.stdout.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    if (!headerSeen) {
      const nl = buf.indexOf(0x0a);
      if (nl < 0) return;
      headerSeen = true;
      const line = buf.slice(0, nl).toString("utf8");
      buf = buf.slice(nl + 1);
      try {
        initHeaderResolve(JSON.parse(line));
      } catch (e) {
        initHeaderReject(e);
        return;
      }
    }
    for (;;) {
      const sep = buf.indexOf("\r\n\r\n");
      if (sep < 0) return;
      const hdr = buf.slice(0, sep).toString("ascii");
      const m = hdr.match(/Content-Length:\s*(\d+)/i);
      if (!m) { buf = buf.slice(sep + 4); continue; }
      const len = Number(m[1]);
      if (buf.length < sep + 4 + len) return;
      const raw = buf.slice(sep + 4, sep + 4 + len).toString("utf8");
      buf = buf.slice(sep + 4 + len);
      msgs.push(JSON.parse(raw));
      notify();
    }
  });

  child.on("close", () => {
    initHeaderReject(new Error(`dap-session closed early (${spec.lang}): ${stderrBuf}`));
  });

  const sendReq = (command, argumentsObj = {}) => {
    const reqSeq = seq++;
    const json = JSON.stringify({ seq: reqSeq, type: "request", command, arguments: argumentsObj });
    const body = Buffer.from(json, "utf8");
    child.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]));
    return reqSeq;
  };

  const waitFor = (label, pred, timeoutMs = 15000) => {
    const hit = msgs.find(pred);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new Error(`timeout waiting for ${label} (${spec.lang}/${spec.mode}), got ${msgs.length} msgs, stderr=${stderrBuf}`));
      }, timeoutMs);
      waiters.push({
        pred,
        resolve: (m) => { clearTimeout(t); resolve(m); },
      });
    });
  };

  try {
    child.stdin.write(JSON.stringify(spec) + "\n");
    const meta = await initHeaderPromise;
    assert.equal(meta.ok, true, `init failed: ${JSON.stringify(meta)}`);

    const initSeq = sendReq("initialize", { adapterID: "coding-dance" });
    await waitFor("initialize resp", (m) => m.type === "response" && m.request_seq === initSeq);
    await waitFor("initialized event", (m) => m.type === "event" && m.event === "initialized");

    const launchSeq = sendReq("launch", {});
    await waitFor("launch resp", (m) => m.type === "response" && m.request_seq === launchSeq);

    const bpSeq = sendReq("setBreakpoints", {
      source: { name: meta.userFile },
      breakpoints: [{ line: bpLine }],
    });
    const bpResp = await waitFor("setBreakpoints resp", (m) => m.type === "response" && m.request_seq === bpSeq);
    assert.equal(bpResp.success, true);

    const cfgSeq = sendReq("configurationDone", {});
    await waitFor("configurationDone resp", (m) => m.type === "response" && m.request_seq === cfgSeq);

    const stop1 = await waitFor("first stopped", (m) => m.type === "event" && m.event === "stopped");
    const tid = stop1.body.threadId;

    const stSeq = sendReq("stackTrace", { threadId: tid });
    const stResp = await waitFor("stackTrace resp", (m) => m.type === "response" && m.request_seq === stSeq);
    const top = stResp.body.stackFrames[0];
    assert.ok(top, "expected non-empty stackFrames");
    assert.equal(top.line, expectStackLine, `expected line ${expectStackLine}, got ${top.line}`);

    const scSeq = sendReq("scopes", { frameId: top.id });
    const scResp = await waitFor("scopes resp", (m) => m.type === "response" && m.request_seq === scSeq);
    const scopeRef = scResp.body.scopes[0].variablesReference;

    const varSeq = sendReq("variables", { variablesReference: scopeRef });
    const varResp = await waitFor("variables resp", (m) => m.type === "response" && m.request_seq === varSeq);
    const vMatch = varResp.body.variables.find((v) => v.name === expectVarName);
    assert.ok(vMatch, `missing var ${expectVarName} in ${JSON.stringify(varResp.body.variables)}`);
    assert.ok(String(vMatch.value).includes(expectVarSubstr), `var ${expectVarName}=${vMatch.value} missing ${expectVarSubstr}`);

    const evSeq = sendReq("evaluate", { expression: evalExpr, frameId: top.id, context: "watch" });
    const evResp = await waitFor("evaluate resp", (m) => m.type === "response" && m.request_seq === evSeq);
    assert.equal(evResp.success, true, `evaluate failed: ${JSON.stringify(evResp)}`);
    assert.ok(String(evResp.body.result).includes(expectEvalSubstr), `eval=${evResp.body.result} missing ${expectEvalSubstr}`);

    if (expectStepLine) {
      const prevStops = msgs.filter((m) => m.type === "event" && m.event === "stopped").length;
      const nextSeq = sendReq("next", { threadId: tid });
      await waitFor("next resp", (m) => m.type === "response" && m.request_seq === nextSeq);
      await waitFor("step stopped", () => msgs.filter((m) => m.type === "event" && m.event === "stopped").length > prevStops);
      const st2Seq = sendReq("stackTrace", { threadId: tid });
      const st2Resp = await waitFor("stackTrace2", (m) => m.type === "response" && m.request_seq === st2Seq);
      assert.equal(st2Resp.body.stackFrames[0].line, expectStepLine);
    }

    const contSeq = sendReq("continue", { threadId: tid });
    await waitFor("continue resp", (m) => m.type === "response" && m.request_seq === contSeq);
    await waitFor("terminated event", (m) => m.type === "event" && m.event === "terminated");

    const stdout = msgs
      .filter((m) => m.type === "event" && m.event === "output" && m.body?.category === "stdout")
      .map((m) => m.body.output)
      .join("");
    assert.ok(!/\x01/.test(stdout), `leaked judge marker in stdout: ${JSON.stringify(stdout)}`);
    if (expectStdoutSubstr) {
      assert.ok(stdout.includes(expectStdoutSubstr), `stdout=${JSON.stringify(stdout)} missing ${expectStdoutSubstr}`);
    }
  } finally {
    try { child.kill("SIGKILL"); } catch {}
    fs.rmSync(workRoot, { recursive: true, force: true });
  }
}

const TWO_SUM_SIG = { fn: "twoSum", params: ["int[]", "int"], ret: "int[]" };

test("Python live DAP (LeetCode & ACM)", { skip: !hasCmd("python3") }, async () => {
  await runLiveDapTest({
    lang: "python",
    mode: "leetcode",
    sig: TWO_SUM_SIG,
    cases: [{ input: [[2, 7, 11, 15], 9] }],
    code: [
      "class Solution:",
      "    def twoSum(self, nums: List[int], target: int) -> List[int]:",
      "        total = nums[0] + nums[1]",
      "        print('dbg:', total)",
      "        return [0, 1]",
    ].join("\n"),
  }, {
    bpLine: 4,
    expectStackLine: 4,
    expectVarName: "total",
    expectVarSubstr: "9",
    evalExpr: "total + 1",
    expectEvalSubstr: "10",
    expectStepLine: 5,
    expectStdoutSubstr: "dbg: 9",
  });

  await runLiveDapTest({
    lang: "python",
    mode: "acm",
    stdin: "4 5\n",
    cases: [{ stdin: "4 5\n" }],
    code: [
      "a, b = map(int, input().split())",
      "s = a + b",
      "print(s * 2)",
    ].join("\n"),
  }, {
    bpLine: 3,
    expectStackLine: 3,
    expectVarName: "s",
    expectVarSubstr: "9",
    evalExpr: "a * b",
    expectEvalSubstr: "20",
    expectStdoutSubstr: "18",
  });
});

test("JavaScript live DAP (LeetCode & ACM)", async () => {
  await runLiveDapTest({
    lang: "javascript",
    mode: "leetcode",
    sig: TWO_SUM_SIG,
    cases: [{ input: [[2, 7, 11, 15], 9] }],
    code: [
      "var twoSum = function(nums, target) {",
      "    const total = nums[0] + nums[1];",
      "    console.log('jsdbg', total);",
      "    return [0, 1];",
      "};",
    ].join("\n"),
  }, {
    bpLine: 3,
    expectStackLine: 3,
    expectVarName: "total",
    expectVarSubstr: "9",
    evalExpr: "total + 1",
    expectEvalSubstr: "10",
    expectStepLine: 4,
    expectStdoutSubstr: "jsdbg 9",
  });

  await runLiveDapTest({
    lang: "javascript",
    mode: "acm",
    stdin: "12 30\n",
    cases: [{ stdin: "12 30\n" }],
    code: [
      "const fs = require('fs');",
      "const [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);",
      "const ans = a + b;",
      "console.log(ans);",
    ].join("\n"),
  }, {
    bpLine: 4,
    expectStackLine: 4,
    expectVarName: "ans",
    expectVarSubstr: "42",
    evalExpr: "ans + 8",
    expectEvalSubstr: "50",
    expectStdoutSubstr: "42",
  });
});

test("TypeScript live DAP (LeetCode & ACM)", async () => {
  await runLiveDapTest({
    lang: "typescript",
    mode: "leetcode",
    sig: TWO_SUM_SIG,
    cases: [{ input: [[2, 7, 11, 15], 9] }],
    code: [
      "function twoSum(nums: number[], target: number): number[] {",
      "    const total: number = nums[0] + nums[1];",
      "    console.log('tsdbg', total);",
      "    return [0, 1];",
      "}",
    ].join("\n"),
  }, {
    bpLine: 3,
    expectStackLine: 3,
    expectVarName: "total",
    expectVarSubstr: "9",
    evalExpr: "total * 2",
    expectEvalSubstr: "18",
    expectStepLine: 4,
    expectStdoutSubstr: "tsdbg 9",
  });

  await runLiveDapTest({
    lang: "typescript",
    mode: "acm",
    stdin: "7 8\n",
    cases: [{ stdin: "7 8\n" }],
    code: [
      'import * as fs from "fs";',
      "const parts: number[] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);",
      "const ans: number = parts[0] * parts[1];",
      "console.log(ans);",
    ].join("\n"),
  }, {
    bpLine: 4,
    expectStackLine: 4,
    expectVarName: "ans",
    expectVarSubstr: "56",
    evalExpr: "ans + 4",
    expectEvalSubstr: "60",
    expectStdoutSubstr: "56",
  });
});

test("Ruby live DAP (LeetCode & ACM)", { skip: !hasCmd("ruby", ["-v"]) }, async () => {
  await runLiveDapTest({
    lang: "ruby",
    mode: "leetcode",
    sig: TWO_SUM_SIG,
    cases: [{ input: [[2, 7, 11, 15], 9] }],
    code: [
      "def two_sum(nums, target)",
      "  total = nums[0] + nums[1]",
      "  puts \"rbdbg:#{total}\"",
      "  [0, 1]",
      "end",
    ].join("\n"),
  }, {
    bpLine: 3,
    expectStackLine: 3,
    expectVarName: "total",
    expectVarSubstr: "9",
    evalExpr: "total + 5",
    expectEvalSubstr: "14",
    expectStepLine: 4,
    expectStdoutSubstr: "rbdbg:9",
  });

  await runLiveDapTest({
    lang: "ruby",
    mode: "acm",
    stdin: "3 14\n",
    cases: [{ stdin: "3 14\n" }],
    code: [
      "a, b = gets.split.map(&:to_i)",
      "ans = a + b",
      "puts ans",
    ].join("\n"),
  }, {
    bpLine: 3,
    expectStackLine: 3,
    expectVarName: "ans",
    expectVarSubstr: "17",
    evalExpr: "a * b",
    expectEvalSubstr: "42",
    expectStdoutSubstr: "17",
  });
});

test("Java live DAP (LeetCode & ACM)", { skip: !hasCmd("javac", ["-version"]) }, async () => {
  await runLiveDapTest({
    lang: "java",
    mode: "leetcode",
    sig: TWO_SUM_SIG,
    cases: [{ input: [[2, 7, 11, 15], 9] }],
    code: [
      "class Solution {",
      "    public int[] twoSum(int[] nums, int target) {",
      "        int total = nums[0] + nums[1];",
      "        System.out.println(\"jdbg:\" + total);",
      "        return new int[]{0, 1};",
      "    }",
      "}",
    ].join("\n"),
  }, {
    bpLine: 4,
    expectStackLine: 4,
    expectVarName: "total",
    expectVarSubstr: "9",
    evalExpr: "total",
    expectEvalSubstr: "9",
    expectStepLine: 5,
    expectStdoutSubstr: "jdbg:9",
  });
});

test("C / Rust / Swift debug compilation + ACM stdin object linkage", async () => {
  for (const [lang, checkCmd, code, stdinText, expectOut] of [
    ["c", "gcc", "#include <stdio.h>\nint main(void){int a,b;if(scanf(\"%d%d\",&a,&b)==2)printf(\"%d\\n\",a+b);return 0;}\n", "19 23\n", "42"],
    ["rust", "rustc", "use std::io::{self, Read};\nfn main(){let mut s=String::new();io::stdin().read_to_string(&mut s).unwrap();let v:Vec<i32>=s.split_whitespace().map(|x|x.parse().unwrap()).collect();println!(\"{}\",v[0]+v[1]);}\n", "11 31\n", "42"],
    ["swift", "swiftc", "import Foundation\nif let l=readLine(){let p=l.split(separator:\" \").compactMap{Int($0)};print(p[0]+p[1])}\n", "20 22\n", "42"],
  ]) {
    if (!hasCmd(checkCmd)) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `dbg-build-${lang}-`));
    try {
      const job = { lang, mode: "acm", code, cases: [{ stdin: stdinText }], debug: true };
      const prog = acmProgram(job);
      const built = await compile(lang, prog, dir, { debug: true, acm: true });
      assert.equal(built.ok, true, `${lang} debug build failed: ${built.error}`);
      fs.writeFileSync(path.join(dir, "dap.stdin"), stdinText);
      const runRes = cp.spawnSync(built.cmd.file, built.cmd.args(0, ""), { cwd: dir, env: built.cmd.env, encoding: "utf8" });
      assert.equal(runRes.status, 0, `${lang} run failed: ${runRes.stderr}`);
      assert.equal(runRes.stdout.trim(), expectOut);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});
