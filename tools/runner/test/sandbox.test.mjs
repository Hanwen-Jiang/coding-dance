// 沙箱的测试：用练习数据（网站真正发过来的签名和用例）跑官方题解，再测崩溃隔离、超时、输出、ACM、编译报错、调试记录。
//   本机：node tools/runner/test/sandbox.test.mjs                （不隔离，只测本机装了工具链的语言）
//   镜像：RUNNER_TEST_IMAGE=lc-runner:ci node tools/runner/test/sandbox.test.mjs   （每个任务一个新容器，六种语言都测，再加安全检查；CI 用）
//   microVM：RUNNER_TEST_FC_URL=http://127.0.0.1:8097 RUNNER_TEST_FC_TOKEN=… node …   （每个任务一台新的 Firecracker microVM；CI 的 Firecracker 任务）
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FirecrackerDriver, LocalDriver, runInFreshContainer } from "../lib/sandbox.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const { codesOf, parseCode, pad4 } = require(path.join(ROOT, "tools/illustrations/judge/code.js"));
const { matches } = require(path.join(ROOT, "tools/illustrations/judge/util.js"));

const FC = process.env.RUNNER_TEST_FC_URL ? new FirecrackerDriver({ url: process.env.RUNNER_TEST_FC_URL, token: process.env.RUNNER_TEST_FC_TOKEN }) : null;
// 镜像或 microVM：隔离的环境，六种语言都有、要测安全限制
const IMAGE = process.env.RUNNER_TEST_IMAGE || (FC ? "firecracker" : "");
const local = new LocalDriver();
async function runJob(job) {
  const input = JSON.stringify({ limits: { caseMs: 5000, totalMs: 60000, steps: 1000 }, ...job });
  const r = FC ? await FC.run(input, 180000) : IMAGE ? await runInFreshContainer(IMAGE, input, { timeoutMs: 180000, runtime: process.env.RUNNER_TEST_RUNTIME || "" }) : await local.run(input, 180000);
  assert.ok(r.ok, "沙箱没有返回结果：" + r.error);
  return r.json;
}

const has = (cmd, args = ["--version"]) => { const r = spawnSync(cmd, args, { stdio: "ignore" }); return !r.error && r.status === 0; };
const LANGS = IMAGE ? ["python", "java", "cpp", "go", "javascript", "typescript"]
  : ["python", "javascript", "typescript", ...(has("javac", ["-version"]) ? ["java"] : []), ...(has("g++") ? ["cpp"] : []), ...(has("go", ["version"]) ? ["go"] : [])];
const DEBUG = LANGS.filter((l) => ["java", "cpp", "go"].includes(l) && (IMAGE || (l === "cpp" ? has("gdb") : l === "go" ? has("dlv", ["version"]) : true)));
const only = process.argv.slice(2);
const want = (lang) => !only.length || only.includes(lang);

let failed = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓ " + name); } catch (e) { failed++; console.log("  ✗ " + name + "\n      " + String(e.stack || e).split("\n").slice(0, 6).join("\n      ")); }
}

const practice = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, "tools/practice/data", pad4(id) + ".json"), "utf8"));
function official(id, lang) {
  const spec = require(path.join(ROOT, "tools/illustrations/specs", `${pad4(id)}.js`));
  const raw = codesOf(spec.codes, pad4(id))[0].raw[lang];
  return raw ? parseCode(raw).code : null;
}

const SUM_SIG = { fn: "twoSum", params: ["int[]", "int"], ret: "int[]" };
const twoSumCases = practice(1).cases.slice(0, 3);

// 官方题解：覆盖各种参数类型（数组、链表、环、相交、随机链表、设计类、树、原地修改、顺序无关）
const PROBLEMS = [1, 2, 141, 160, 138, 146, 236, 102, 48, 49, 206, 155];

console.log(`语言：${LANGS.join(", ")}${IMAGE ? `（镜像 ${IMAGE}）` : "（本机，不隔离）"}`);
for (const lang of LANGS.filter(want)) {
  console.log(`\n${lang}`);
  for (const id of PROBLEMS) {
    const code = official(id, lang);
    if (!code) continue;
    await test(`官方题解 ${id}`, async () => {
      const P = practice(id);
      const r = await runJob({ lang, mode: "leetcode", code, sig: P.signature, cases: P.cases.map((c) => ({ input: c.input })) });
      assert.equal(r.compileError, undefined, r.compileError);
      r.results.forEach((x, k) => assert.ok(!x.error && matches(P.cases[k].expected, x.actual, P.signature.cmp), `第 ${k + 1} 组：${x.error || JSON.stringify(x.actual)}，期望 ${JSON.stringify(P.cases[k].expected)}`));
    });
  }
}

// —— 每种语言写一份「会出问题」的两数之和：nums[0] == 99 时崩溃，== 98 时死循环，否则打印一行再给出正确答案 ——
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
// 第 3 行写错（少分号 / 未定义的名字）
const BROKEN = {
  python: "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1\n",
  javascript: "var twoSum = function(nums, target) {\n  const x = 1;\n  return [0, 1;\n};\n",
  java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        int x = 1\n        return new int[]{0, 1};\n    }\n}\n",
  cpp: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) { int x = y;\n        return {0, 1};\n    }\n};\n",
  go: "func twoSum(nums []int, target int) []int {\n\tx := 1\n\treturn []int{0, y}\n}\n",
};

for (const lang of LANGS.filter(want)) {
  console.log(`\n${lang}：出错和输出`);
  await test("一组崩溃、一组超时，其他组照常", async () => {
    const cases = [{ input: [[99, 1], 100] }, { input: [[2, 7, 11, 15], 9] }, { input: [[98, 1], 99] }, { input: [[3, 2, 4], 6] }];
    const r = await runJob({ lang, mode: "leetcode", code: BAD[lang], sig: SUM_SIG, cases, limits: { caseMs: 2000, totalMs: 60000 } });
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

// —— 调试：Java / C++ / Go 在真调试器下记录每一步 ——
const LOOP = {
  java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> seen = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int need = target - nums[i];\n            if (seen.containsKey(need)) return new int[]{seen.get(need), i};\n            seen.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}\n",
  cpp: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        unordered_map<int, int> seen;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            int need = target - nums[i];\n            if (seen.count(need)) return {seen[need], i};\n            seen[nums[i]] = i;\n        }\n        return {};\n    }\n};\n",
  go: "func twoSum(nums []int, target int) []int {\n\tseen := map[int]int{}\n\tfor i, x := range nums {\n\t\tneed := target - x\n\t\tif j, ok := seen[need]; ok {\n\t\t\treturn []int{j, i}\n\t\t}\n\t\tseen[x] = i\n\t}\n\treturn nil\n}\n",
};
for (const lang of DEBUG.filter(want)) {
  console.log(`\n${lang}：调试`);
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
    // need 第一次出现时已经算好了（target - nums[i]），不是没初始化的值
    const need = withNeed.vars.find(([k]) => k === "need")[1], i = withNeed.vars.find(([k]) => k === "i");
    if (i) assert.equal(Number(need), 6 - [3, 2, 4][Number(i[1])], "need 的值：" + JSON.stringify(withNeed.vars));
    assert.ok(steps.some((s) => s.vars.some(([k, v]) => k === "nums" && /3/.test(v))), "nums 的值：" + JSON.stringify(steps[0].vars));
    assert.ok(steps.every((s) => s.stack.length >= 1 && s.stack[s.stack.length - 1][0] === "twoSum"), "调用栈：" + JSON.stringify(steps[0].stack));
    const ret = steps.find((s) => s.event === "return");
    if (ret) assert.match(ret.ret || "", /1.*2/, "返回值：" + JSON.stringify(ret));
    console.log(`      ${steps.length} 步；${ret ? "有" : "没有"} return；例：第 ${withNeed.line} 行 ${JSON.stringify(withNeed.vars).slice(0, 160)}`);
  });
  await test("调试 ACM 模式", async () => {
    const r = await runJob({ lang, mode: "acm", code: ACM[lang], cases: [{ stdin: "20 22\n" }], debug: true });
    const x = r.results[0];
    assert.equal(x.stdout.trim(), "42", JSON.stringify(x).slice(0, 600));
    assert.ok(x.trace && x.trace.steps.length >= 2, "步数：" + JSON.stringify(x.trace).slice(0, 600));
  });
}

// —— 安全：只在容器里测 ——
if (IMAGE && want("security")) {
  console.log("\n容器的限制");
  const probe = `import os, socket, subprocess
def tryit(f):
    try:
        f()
        return "通"
    except Exception as e:
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
    const input = JSON.stringify({ lang: "python", mode: "acm", code: bomb, cases: [{ stdin: "" }], limits: { caseMs: 5000, totalMs: 20000 } });
    if (FC) {
      const r = await FC.run(input, 30000);
      assert.ok(r.ok || r.error, "要么有结果要么报错");
    } else {
      const r = await runJob(JSON.parse(input));
      assert.match(r.results[0].stdout, /挡住了 True/, JSON.stringify(r.results[0]));
    }
    const after = await runJob({ lang: "python", mode: "acm", code: "print(6 * 7)\n", cases: [{ stdin: "" }] });
    assert.equal(after.results[0].stdout.trim(), "42");
  });
  if (FC) await test("microVM 里看到的是它自己的内核", async () => {
    const r = await runJob({ lang: "python", mode: "acm", code: "import platform\nprint(platform.release())\n", cases: [{ stdin: "" }] });
    assert.match(r.results[0].stdout, /agentruntime/, "客户机内核的版本号带 -agentruntime：" + r.results[0].stdout);
  });
  await test("内存用太多被停下", async () => {
    const hog = "x = []\nwhile True:\n    x.append(bytearray(50 << 20))\n";
    const r = await runJob({ lang: "python", mode: "acm", code: hog, cases: [{ stdin: "" }], limits: { caseMs: 10000, totalMs: 20000 } });
    assert.ok(r.results[0].error, JSON.stringify(r.results[0]));
  });
}

console.log(`\n${failed ? "✗" : "✓"} ${passed} 项通过${failed ? `，${failed} 项失败` : ""}`);
if (failed) process.exit(1);
