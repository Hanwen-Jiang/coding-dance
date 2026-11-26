// 远端运行器与沙箱端到端集成测试（经真实 Go 单二进制 cd-runner 的签名 HTTP /v1/run 与 WebSocket /v1/dap 接口）：
//   本机：node tools/runner/test/sandbox.test.mjs                （cd-runner local 驱动，测本机装了工具链的语言与 DAP）
//   镜像：RUNNER_TEST_IMAGE=lc-runner:ci node tools/runner/test/sandbox.test.mjs   （cd-runner docker 驱动，十五种语言 + DAP + 容器隔离检查）
//   microVM：RUNNER_TEST_FC_URL=http://127.0.0.1:8097 RUNNER_TEST_FC_TOKEN=… node … （cd-runner firecracker 驱动，经真 fc-manager 跑真 microVM）
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOLUTIONS, BAD as MORE_BAD, ACM as MORE_ACM, BROKEN as MORE_BROKEN } from "./languages.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const { codesOf, parseCode, pad4 } = require(path.join(ROOT, "tools/illustrations/judge/code.js"));
const { matches } = require(path.join(ROOT, "tools/illustrations/judge/util.js"));

const FC_URL = process.env.RUNNER_TEST_FC_URL || "";
const FC_TOKEN = process.env.RUNNER_TEST_FC_TOKEN || "";
const IMAGE = process.env.RUNNER_TEST_IMAGE || (FC_URL ? "firecracker" : "");

function ensureCdRunnerBin() {
  if (process.env.CD_RUNNER_BIN && fs.existsSync(process.env.CD_RUNNER_BIN)) return process.env.CD_RUNNER_BIN;
  const bin = path.join(os.tmpdir(), `cd-runner-test-${process.pid}${process.platform === "win32" ? ".exe" : ""}`);
  const r = spawnSync("go", ["build", "-o", bin, "./cmd/cd-runner"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, CGO_ENABLED: "0" } });
  if (r.status !== 0) throw new Error("编译 cd-runner 失败：\n" + (r.stderr || r.stdout));
  return bin;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
    s.on("error", reject);
  });
}

const SECRET = "cd-runner-e2e-secret-0123456789abcdef0123";
const NODE = "lou1";
const sha256 = (b) => crypto.createHash("sha256").update(b ?? "").digest("hex");
function signReq(method, urlPath, body = "", user = "tester", now = Date.now()) {
  const time = String(Math.floor(now / 1000)), nonce = crypto.randomBytes(12).toString("hex");
  const canonical = [method.toUpperCase(), urlPath, time, nonce, user, NODE, sha256(body)].join("\n");
  const sig = crypto.createHmac("sha256", SECRET).update(canonical).digest("hex");
  return { time, nonce, user, node: NODE, sig, headers: { "x-runner-time": time, "x-runner-nonce": nonce, "x-runner-user": user, "x-runner-node": NODE, "x-runner-signature": sig } };
}

const runnerBin = ensureCdRunnerBin();
const port = await freePort();
const driverName = FC_URL ? "firecracker" : IMAGE ? "docker" : "local";
const runnerProc = spawn(runnerBin, [], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    RUNNER_NODE_ID: NODE,
    RUNNER_HOST: "127.0.0.1",
    RUNNER_PORT: String(port),
    RUNNER_SECRET: SECRET,
    RUNNER_DRIVER: driverName,
    RUNNER_ALLOW_LOCAL: "1",
    RUNNER_ALLOW_DOCKER: "1",
    RUNNER_FC_URL: FC_URL || "http://127.0.0.1:8097",
    RUNNER_FC_TOKEN: FC_TOKEN,
    RUNNER_IMAGE: process.env.RUNNER_TEST_IMAGE || "lc-runner:ci",
    RUNNER_RUNTIME: process.env.RUNNER_TEST_RUNTIME || "",
    RUNNER_POOL: "1",
    RUNNER_SLOTS: "4",
    RUNNER_QUEUE: "32",
    RUNNER_USER_PER_MIN: "5000",
    RUNNER_CASE_MS: "5000",
    RUNNER_TOTAL_MS: "60000",
    RUNNER_JOB_MS: FC_URL ? "90000" : "180000",
  },
});
let runnerStderr = "";
runnerProc.stderr.on("data", (c) => { runnerStderr = (runnerStderr + c).slice(-4000); });

const baseUrl = `http://127.0.0.1:${port}`;
for (let k = 0; k < 100; k++) {
  try {
    const h = await fetch(baseUrl + "/healthz");
    if (h.ok) break;
  } catch {}
  if (runnerProc.exitCode !== null) throw new Error("cd-runner 提前退出：" + runnerStderr);
  await new Promise((r) => setTimeout(r, 100));
}

let userSeq = 0;
async function runJobRaw(job) {
  const body = JSON.stringify({ limits: { caseMs: 5000, totalMs: 60000, steps: 1000 }, ...job });
  const u = "u" + (++userSeq);
  const { headers } = signReq("POST", "/v1/run", body, u);
  const res = await fetch(baseUrl + "/v1/run", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    signal: AbortSignal.timeout(190000),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json, error: json.error };
}

async function runJob(job) {
  const r = await runJobRaw(job);
  assert.ok(r.ok, `cd-runner 返回 ${r.status}：${r.error || JSON.stringify(r.json)}`);
  return r.json;
}

const has = (cmd, args = ["--version"]) => { const r = spawnSync(cmd, args, { stdio: "ignore" }); return !r.error && r.status === 0; };
const MORE = { c: ["gcc"], csharp: ["dotnet", ["--list-sdks"]], kotlin: ["kotlinc", ["-version"]], swift: ["swiftc"], rust: ["rustc"], ruby: ["ruby"], php: ["php"], scala: ["scalac", ["-version"]], dart: ["dart"] };
const LANGS = IMAGE ? ["python", "java", "cpp", "go", "javascript", "typescript", ...Object.keys(MORE)]
  : ["python", "javascript", "typescript", ...(has("javac", ["-version"]) ? ["java"] : []), ...(has("g++") ? ["cpp"] : []), ...(has("go", ["version"]) ? ["go"] : []),
    ...Object.entries(MORE).filter(([, [cmd, args]]) => has(cmd, args)).map(([l]) => l)];
const DEBUG = LANGS.filter((l) => ["java", "cpp", "go"].includes(l) && (IMAGE || (l === "cpp" ? has("gdb") : l === "go" ? has("dlv", ["version"]) : true)));
const only = process.argv.slice(2);
const want = (lang) => !only.length || only.includes(lang);

let failed = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓ " + name); } catch (e) { failed++; console.log("  ✗ " + name + "\n      " + String(e.stack || e).split("\n").slice(0, 6).join("\n      ")); }
}

try {
  const practice = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, "tools/practice/data", pad4(id) + ".json"), "utf8"));
  function official(id, lang) {
    const spec = require(path.join(ROOT, "tools/illustrations/specs", `${pad4(id)}.js`));
    const raw = codesOf(spec.codes, pad4(id))[0].raw[lang];
    return raw ? parseCode(raw).code : null;
  }

  const SUM_SIG = { fn: "twoSum", params: ["int[]", "int"], ret: "int[]" };
  const twoSumCases = practice(1).cases.slice(0, 3);
  const PROBLEMS = [1, 2, 141, 160, 138, 146, 236, 102, 48, 49, 206, 155];

  console.log(`cd-runner (${driverName}) 语言：${LANGS.join(", ")}`);
  for (const lang of LANGS.filter(want)) {
    console.log(`\n${lang}`);
    for (const id of SOLUTIONS[lang] ? Object.keys(SOLUTIONS[lang]).map(Number) : PROBLEMS) {
      const code = SOLUTIONS[lang]?.[id] ?? official(id, lang);
      if (!code) continue;
      await test(`${SOLUTIONS[lang] ? "手写题解" : "官方题解"} ${id}`, async () => {
        const P = practice(id);
        const r = await runJob({ lang, mode: "leetcode", code, sig: P.signature, cases: P.cases.map((c) => ({ input: c.input })) });
        assert.equal(r.compileError, undefined, r.compileError);
        r.results.forEach((x, k) => assert.ok(!x.error && matches(P.cases[k].expected, x.actual, P.signature.cmp), `第 ${k + 1} 组：${x.error || JSON.stringify(x.actual)}，期望 ${JSON.stringify(P.cases[k].expected)}`));
      });
    }
  }

  const BAD = {
    python: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        if nums[0] == 99:
            return [None][5]
        while nums[0] == 98:
            pass
        print("看看", len(nums))
        seen = {}
        for i, x in enumerate(nums):
            if target - x in seen:
                return [seen[target - x], i]
            seen[x] = i
        return []`,
    javascript: `var twoSum = function(nums, target) {
  if (nums[0] === 99) { const a = null; return a.x; }
  while (nums[0] === 98) {}
  console.log("看看", nums.length);
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
  return [];
};`,
    java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        if (nums[0] == 99) { int[] a = new int[1]; return new int[]{a[5]}; }
        while (nums[0] == 98) {}
        System.out.println("看看 " + nums.length);
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            if (seen.containsKey(target - nums[i])) return new int[]{seen.get(target - nums[i]), i};
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}`,
    cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        if (nums[0] == 99) { int* p = nullptr; return {*p}; }
        while (nums[0] == 98) {}
        cout << "看看 " << nums.size() << endl;
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            if (seen.count(target - nums[i])) return {seen[target - nums[i]], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`,
    go: `func twoSum(nums []int, target int) []int {
	if nums[0] == 99 {
		var a []int
		return []int{a[5]}
	}
	for nums[0] == 98 {
	}
	fmt.Println("看看", len(nums))
	seen := map[int]int{}
	for i, x := range nums {
		if j, ok := seen[target-x]; ok {
			return []int{j, i}
		}
		seen[x] = i
	}
	return nil
}`,
  };
  BAD.typescript = BAD.javascript.replace("var twoSum = function(nums, target) {", "function twoSum(nums: number[], target: number): number[] {").replace(/};$/, "}").replace("const a = null; return a.x;", "const a: any = null; return a.x;");

  const ACM = {
    python: "a, b = map(int, input().split())\nprint(a + b)\n",
    javascript: 'const [a, b] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n',
    typescript: 'import { readFileSync } from "node:fs";\nconst [a, b] = readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n',
    java: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        System.out.println(in.nextLong() + in.nextLong());\n    }\n}\n",
    cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n}\n",
    go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar a, b int\n\tfmt.Scan(&a, &b)\n\tfmt.Println(a + b)\n}\n',
  };
  const BROKEN = {
    python: "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1\n",
    javascript: "var twoSum = function(nums, target) {\n  const x = 1;\n  return [0, 1;\n};\n",
    typescript: "function twoSum(nums: number[], target: number): number[] {\n  const x: number = 1;\n  return [0, 1;\n}\n",
    java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        int x = 1\n        return new int[]{0, 1};\n    }\n}\n",
    cpp: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) { int x = y;\n        return {0, 1};\n    }\n};\n",
    go: "func twoSum(nums []int, target int) []int {\n\tx := 1\n\treturn []int{0, y}\n}\n",
  };
  Object.assign(BAD, MORE_BAD);
  Object.assign(ACM, MORE_ACM);
  Object.assign(BROKEN, MORE_BROKEN);

  for (const lang of LANGS.filter(want)) {
    console.log(`\n${lang}：出错和输出`);
    await test("一组崩溃、一组超时，其他组照常", async () => {
      const cases = [{ input: [[99, 1], 100] }, { input: [[2, 7, 11, 15], 9] }, { input: [[98, 1], 99] }, { input: [[3, 2, 4], 6] }];
      const r = await runJob({ lang, mode: "leetcode", code: BAD[lang], sig: SUM_SIG, cases });
      assert.ok(r.results[0].error, "第 1 组应该出错");
      assert.deepEqual(r.results[1].actual, [0, 1], "第 2 组：" + (r.results[1].error || ""));
      assert.match(r.results[2].error || "", /超时/, "第 3 组应该超时：" + JSON.stringify(r.results[2]));
      assert.deepEqual(r.results[3].actual, [1, 2], "第 4 组：" + (r.results[3].error || ""));
      assert.match(r.results[1].stdout, /看看 ?4/, "第 2 组的输出：" + JSON.stringify(r.results[1].stdout));
      if (lang !== "cpp") assert.match(r.results[0].error, /第 [2-4] 行/, "出错的行号：" + r.results[0].error);
    });
    await test("ACM 模式", async () => {
      const r = await runJob({ lang, mode: "acm", code: ACM[lang], cases: [{ stdin: "1 2\n" }, { stdin: "40 2\n" }] });
      assert.equal(r.compileError, undefined, r.compileError);
      assert.deepEqual(r.results.map((x) => x.stdout.trim()), ["3", "42"], JSON.stringify(r.results));
    });
    if (BROKEN[lang]) await test("编译报错带编辑器里的行号", async () => {
      const r = await runJob({ lang, mode: "leetcode", code: BROKEN[lang], sig: SUM_SIG, cases: twoSumCases.map((c) => ({ input: c.input })) });
      assert.ok(r.compileError, "应该编译不过：" + JSON.stringify(r.results[0]));
      assert.match(r.compileError, /第 3 行/, r.compileError);
    });
  }

  if (LANGS.includes("typescript") && want("typescript")) {
    console.log("\ntypescript：要转换的写法");
    await test("enum 和 constructor(public x) 能运行，运行时出错的行号还是编辑器里的", async () => {
      const code = "enum Pick { First = 0 }\nclass Seen { constructor(public map: Map<number, number>) {} }\nfunction twoSum(nums: number[], target: number): number[] {\n  if (nums[0] === 99) { const a: any = null; return a.x; }\n  const s = new Seen(new Map());\n  for (let i = Pick.First; i < nums.length; i++) {\n    if (s.map.has(target - nums[i])) return [s.map.get(target - nums[i])!, i];\n    s.map.set(nums[i], i);\n  }\n  return [];\n}\n";
      const r = await runJob({ lang: "typescript", mode: "leetcode", code, sig: SUM_SIG, cases: [{ input: [[2, 7, 11, 15], 9] }, { input: [[99, 1], 100] }] });
      assert.equal(r.compileError, undefined, r.compileError);
      assert.deepEqual(r.results[0].actual, [0, 1], JSON.stringify(r.results[0]));
      assert.match(r.results[1].error || "", /第 4 行/, JSON.stringify(r.results[1]));
    });
    await test("ACM 模式的语法错误是编译错误", async () => {
      const r = await runJob({ lang: "typescript", mode: "acm", code: 'import { readFileSync } from "node:fs";\nconst x: number = 1;\nconsole.log(x +);\n', cases: [{ stdin: "1 2\n" }] });
      assert.match(r.compileError || "", /第 3 行/, JSON.stringify(r));
    });
  }

  const LOOP = {
    java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> seen = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int need = target - nums[i];\n            if (seen.containsKey(need)) return new int[]{seen.get(need), i};\n            seen.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}\n",
    cpp: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int, int> seen;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            int need = target - nums[i];\n            if (seen.count(need)) return {seen[need], i};\n            seen[nums[i]] = i;\n        }\n        return {};\n    }\n};\n",
    go: "func twoSum(nums []int, target int) []int {\n\tseen := map[int]int{}\n\tfor i, x := range nums {\n\t\tneed := target - x\n\t\tif j, ok := seen[need]; ok {\n\t\t\treturn []int{j, i}\n\t\t}\n\t\tseen[x] = i\n\t}\n\treturn nil\n}\n",
  };
  const DAP_BP_LINE = { java: 5, cpp: 6, go: 4 };

  for (const lang of DEBUG.filter(want)) {
    console.log(`\n${lang}：调试（执行记录 + WebSocket DAP 交互会话）`);
    await test("执行记录：行号、变量、调用栈、返回值", async () => {
      const r = await runJob({ lang, mode: "leetcode", code: LOOP[lang], sig: SUM_SIG, cases: [{ input: [[3, 2, 4], 6] }], debug: true });
      const x = r.results[0];
      assert.deepEqual(x.actual, [1, 2], "结果：" + (x.error || JSON.stringify(x)));
      const steps = x.trace && x.trace.steps;
      assert.ok(steps && steps.length >= 5, "步数太少：" + JSON.stringify(x.trace).slice(0, 800));
      const n = LOOP[lang].trim().split("\n").length;
      assert.ok(steps.every((s) => s.line >= 1 && s.line <= n), "行号超出用户代码：" + JSON.stringify(steps.map((s) => s.line)));
      const withNeed = steps.find((s) => s.vars.some(([k]) => k === "need"));
      assert.ok(withNeed, "没有记到变量 need：" + JSON.stringify(steps.slice(0, 6)));
      const need = withNeed.vars.find(([k]) => k === "need")[1], i = withNeed.vars.find(([k]) => k === "i");
      if (i) assert.equal(Number(need), 6 - [3, 2, 4][Number(i[1])], "need 的值：" + JSON.stringify(withNeed.vars));
      assert.ok(steps.some((s) => s.vars.some(([k, v]) => k === "nums" && /3/.test(v))), "nums 的值：" + JSON.stringify(steps[0].vars));
      assert.ok(steps.every((s) => s.stack.length >= 1 && s.stack[s.stack.length - 1][0] === "twoSum"), "调用栈：" + JSON.stringify(steps[0].stack));
    });
    await test("调试 ACM 模式", async () => {
      const r = await runJob({ lang, mode: "acm", code: ACM[lang], cases: [{ stdin: "20 22\n" }], debug: true });
      const x = r.results[0];
      assert.equal(x.stdout.trim(), "42", JSON.stringify(x).slice(0, 600));
      assert.ok(x.trace && x.trace.steps.length >= 2, "步数：" + JSON.stringify(x.trace).slice(0, 600));
    });
    if (typeof WebSocket !== "undefined") {
      await test("WebSocket DAP 交互会话：下断点、停在用户代码行、断连销毁", async () => {
        const s = signReq("GET", "/v1/dap", "", "dap-" + (++userSeq));
        const wsUrl = `ws://127.0.0.1:${port}/v1/dap?time=${s.time}&nonce=${s.nonce}&user=${s.user}&node=${s.node}&sig=${s.sig}`;
        const ws = new WebSocket(wsUrl);
        const queue = [];
        let wake = null;
        ws.onmessage = (ev) => {
          queue.push(JSON.parse(String(ev.data)));
          if (wake) { const w = wake; wake = null; w(); }
        };
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
        const waitMsg = async (pred, ms = 45000) => {
          const deadline = Date.now() + ms;
          for (;;) {
            const idx = queue.findIndex(pred);
            if (idx >= 0) return queue.splice(idx, 1)[0];
            const rem = deadline - Date.now();
            if (rem <= 0) throw new Error("等待 DAP 消息超时，收到：" + JSON.stringify(queue));
            await new Promise((r) => { const t = setTimeout(r, rem); wake = () => { clearTimeout(t); r(); }; });
          }
        };
        ws.send(JSON.stringify({ type: "init", lang, mode: "leetcode", code: LOOP[lang], sig: SUM_SIG, cases: [{ input: [[3, 2, 4], 6] }] }));
        const ready = await waitMsg((m) => m.type === "ready" || m.type === "error" || m.type === "compile_error");
        assert.equal(ready.type, "ready", JSON.stringify(ready));
        ws.send(JSON.stringify({ seq: 1, type: "request", command: "initialize", arguments: { adapterID: lang } }));
        await waitMsg((m) => m.type === "response" && m.command === "initialize");
        ws.send(JSON.stringify({ seq: 2, type: "request", command: "launch", arguments: {} }));
        await waitMsg((m) => m.type === "event" && m.event === "initialized");
        ws.send(JSON.stringify({ seq: 3, type: "request", command: "setBreakpoints", arguments: { breakpoints: [{ line: DAP_BP_LINE[lang] }] } }));
        await waitMsg((m) => m.type === "response" && m.command === "setBreakpoints");
        ws.send(JSON.stringify({ seq: 4, type: "request", command: "configurationDone", arguments: {} }));
        const stopped = await waitMsg((m) => m.type === "event" && m.event === "stopped");
        const tid = stopped.body.threadId;
        ws.send(JSON.stringify({ seq: 5, type: "request", command: "stackTrace", arguments: { threadId: tid } }));
        const st = await waitMsg((m) => m.type === "response" && m.command === "stackTrace");
        assert.equal(st.body.stackFrames[0].line, DAP_BP_LINE[lang], "断点停住的行号应映射回编辑器行号");
        ws.send(JSON.stringify({ seq: 6, type: "request", command: "disconnect", arguments: { terminateDebuggee: true } }));
        ws.close();
      });
    }
  }

  if (IMAGE && want("security")) {
    console.log("\n容器 / microVM 隔离限制");
    const probe = `import os, socket
def tryit(f):
    try:
        f()
        return "通"
    except Exception:
        return "不通"
def net():
    socket.create_connection(("1.1.1.1", 53), timeout=2)
def write():
    open("/etc/x", "w").write("x")
def root():
    assert os.getuid() == 0
print("网络", tryit(net))
print("写系统文件", tryit(write))
print("root", tryit(root))
`;
    await test("不能上网、不能写系统文件、不是 root", async () => {
      const r = await runJob({ lang: "python", mode: "acm", code: probe, cases: [{ stdin: "" }] });
      assert.equal(r.results[0].stdout.trim(), "网络 不通\n写系统文件 不通\nroot 不通", JSON.stringify(r.results[0]));
    });
    await test("fork 炸弹：容器里被进程数限制挡住；microVM 里只拖垮它自己那台，下一次照常", async () => {
      const bomb = "import os\nn = 0\ntry:\n    while True:\n        if os.fork() == 0:\n            import time; time.sleep(30)\n        n += 1\nexcept OSError:\n    print('挡住了', n < 400)\n";
      const job = { lang: "python", mode: "acm", code: bomb, cases: [{ stdin: "" }], limits: { caseMs: 5000, totalMs: 20000 } };
      if (FC_URL) {
        const r = await runJobRaw(job);
        assert.ok(r.ok || r.error, "要么有结果要么报错");
      } else {
        const r = await runJob(job);
        assert.match(r.results[0].stdout, /挡住了 True/, JSON.stringify(r.results[0]));
      }
      const after = await runJob({ lang: "python", mode: "acm", code: "print(6 * 7)\n", cases: [{ stdin: "" }] });
      assert.equal(after.results[0].stdout.trim(), "42");
    });
    if (FC_URL) await test("microVM 里看到的是它自己的内核", async () => {
      const r = await runJob({ lang: "python", mode: "acm", code: "import platform\nprint(platform.release())\n", cases: [{ stdin: "" }] });
      assert.match(r.results[0].stdout, /agentruntime/, "客户机内核的版本号带 -agentruntime：" + r.results[0].stdout);
    });
    await test("内存用太多被停下", async () => {
      const hog = "x = []\nwhile True:\n    x.append(bytearray(50 << 20))\n";
      const r = await runJob({ lang: "python", mode: "acm", code: hog, cases: [{ stdin: "" }] });
      assert.ok(r.results[0].error, JSON.stringify(r.results[0]));
    });
  }
} finally {
  runnerProc.kill("SIGTERM");
  if (!process.env.CD_RUNNER_BIN) fs.rmSync(runnerBin, { force: true });
}

console.log(`\n${failed ? "✗" : "✓"} ${passed} 项通过${failed ? `，${failed} 项失败` : ""}`);
if (failed) process.exit(1);
