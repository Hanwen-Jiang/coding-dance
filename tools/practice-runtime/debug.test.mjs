// 练习区的调试（执行记录）：node tools/practice-runtime/debug.test.mjs（要 site/node_modules 里有 pyodide 和 typescript）
// - Python：python-runner.py 用 sys.settrace 记每一步，几种题型都看一遍，记满步数会停下，不调试时结果不变；
// - JS / TS：instrument.js 改写源码 + kernel.js 记录。全部官方题解插桩前后答案一样，插桩后的 TS 照样能转译。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rt = path.join(root, "site/public/practice-runtime");
// 包默认从 site/node_modules 找；装在别处时用 PRACTICE_NODE_MODULES 指过去
const modules = process.env.PRACTICE_NODE_MODULES || path.join(root, "site/node_modules");
const require = createRequire(path.join(modules, "..", "package.json"));
const ts = require(path.join(modules, "typescript"));
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(rt, "kernel.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(rt, "instrument.js"), "utf8"), context);
const execute = context.PracticeKernel.executeJavaScript, instrument = context.PracticeInstrument;
const { loadPyodide } = await import(pathToFileURL(path.join(modules, "pyodide/pyodide.mjs")).href);
const python = await loadPyodide({ indexURL: path.join(modules, "pyodide") + path.sep, stdout: () => {}, stderr: () => {} });
python.runPython(fs.readFileSync(path.join(rt, "python-runner.py"), "utf8"));
const runPython = (code, mode, signature, test, trace = true) => {
  python.globals.set("__practice_request_json", JSON.stringify({ code, mode, signature, test, trace }));
  return JSON.parse(python.runPython("__practice_run(__practice_request_json)"));
};
const toJs = (code) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }, reportDiagnostics: true });
const runJs = (code, language, mode, signature, test) => {
  let src = instrument(ts, code, language, mode);
  if (language === "typescript") src = toJs(src).outputText;
  // kernel 跑在 vm 里，数组、对象的原型和这里不是同一个：转一遍 JSON 再比
  return JSON.parse(JSON.stringify(execute(src, mode, signature, test, true)));
};
const vars = (step) => Object.fromEntries(step.vars);
const TWO = { fn: "twoSum", params: ["int[]", "int"], ret: "int[]" };

// —— Python ——
{
  const code = "class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, x in enumerate(nums):\n            if target - x in seen:\n                return [seen[target - x], i]\n            seen[x] = i\n";
  const r = runPython(code, "leetcode", TWO, { input: [[2, 7, 11, 15], 9] });
  assert.deepEqual(r.actual, [0, 1]);
  const steps = r.trace.steps;
  assert.deepEqual(steps.map((s) => s.line), [3, 4, 5, 7, 4, 5, 6, 6], "力扣模式从调用 Solution 开始记，不记 class、def 那几行");
  assert.deepEqual(vars(steps[4]), { nums: "[2, 7, 11, 15]", target: "9", seen: "{2: 0}", i: "0", x: "2" });
  assert.equal(steps.at(-1).event, "return");
  assert.equal(steps.at(-1).ret, "[0, 1]");
  assert.deepEqual(steps[0].stack, [["twoSum", 3]]);
  assert.deepEqual(runPython(code, "leetcode", TWO, { input: [[3, 3], 6] }, false), { actual: [0, 1], stdout: "" }, "不调试时结果和原来一样，没有 trace");

  const loop = runPython("class Solution:\n    def twoSum(self, nums, target):\n        while True:\n            try:\n                pass\n            except Exception:\n                pass\n", "leetcode", TWO, { input: [[1], 1] });
  assert.equal(loop.trace.steps.length, 1000);
  assert.equal(loop.trace.truncated, true);
  assert.match(loop.error, /最多记录 1000 步/, "记满了步数：抛出来停下，except Exception 拦不住");

  const list = runPython("class Solution:\n    def reverseList(self, head):\n        prev = None\n        while head:\n            head.next, prev, head = prev, head, head.next\n        return prev\n", "leetcode", { fn: "reverseList", params: ["ListNode"], ret: "ListNode" }, { input: [[1, 2, 3]] });
  assert.deepEqual(list.actual, [3, 2, 1]);
  assert.equal(vars(list.trace.steps.at(-1)).prev, "ListNode(3 → 2 → 1)");

  // Counter 这类 dict 子类按容器缩短、带类型名，不再从中间截（以前是「Counter({0: 1, 1'..., 19: 1})」）；长字符串截后面
  const many = runPython("from collections import Counter\nclass Solution:\n    def twoSum(self, nums, target):\n        c = Counter(nums)\n        s = 'x' * 100\n        return [0, 1]\n", "leetcode", TWO, { input: [Array.from({ length: 20 }, (_, i) => i), 1] });
  const last = vars(many.trace.steps.at(-1));
  assert.match(last.c, /^Counter\(\{0: 1, 1: 1, .*9: 1, …\}\)$/, last.c);
  assert.ok(last.s.startsWith("'xxxx") && last.s.endsWith("…'") && last.s.length === 63, last.s);

  const lru = runPython("class LRUCache:\n    def __init__(self, capacity):\n        self.cap = capacity\n        self.d = {}\n    def get(self, key):\n        return self.d.get(key, -1)\n    def put(self, key, value):\n        self.d[key] = value\n", "leetcode",
    { cls: "LRUCache", ctor: ["int"], methods: { get: [["int"], "int"], put: [["int", "int"], "void"] } }, { input: [["LRUCache", "put", "get"], [[2], [1, 1], [1]]] });
  assert.deepEqual(lru.actual, [null, null, 1]);
  assert.deepEqual(vars(lru.trace.steps.at(-1)), { "self.cap": "2", "self.d": "{1: 1}", key: "1" }, "设计类题列出 self 的字段");

  const acm = runPython("n = int(input())\ntotal = 0\nfor k in range(n):\n    total += k\nprint(total)\n", "acm", {}, { stdin: "3\n" });
  assert.equal(acm.stdout, "3\n");
  assert.deepEqual(vars(acm.trace.steps.find((s) => s.line === 5)), { n: "3", total: "3", k: "2" }, "ACM 模式模块级变量里不列预先导入的名字");
  assert.equal(acm.trace.steps.at(-1).out, 2, "out 是到这一步为止的输出长度");

  const boom = runPython("class Solution:\n    def twoSum(self, nums, target):\n        return nums[10]\n", "leetcode", TWO, { input: [[1], 1] });
  assert.match(boom.error, /IndexError/);
  assert.ok(boom.trace.steps.some((s) => s.event === "exception" && /IndexError/.test(s.exc)));
}

// —— JavaScript / TypeScript ——
{
  const r = runJs("var twoSum = function(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n};", "javascript", "leetcode", TWO, { input: [[2, 7, 11, 15], 9] });
  assert.deepEqual(r.actual, [0, 1]);
  assert.deepEqual(r.trace.steps.map((s) => s.line), [2, 3, 4, 5, 6, 4, 5, 5], "力扣模式不记最外层；同一行上的 if 和 return 变量没变只算一步");
  assert.deepEqual(vars(r.trace.steps[5]), { nums: "[2, 7, 11, 15]", target: "9", seen: "Map(1) {2 => 0}", i: "1" }, "还没声明到的 need（暂时性死区）不列");
  assert.equal(r.trace.steps.at(-1).ret, "[0, 1]");

  const lru = runJs("class LRUCache {\n  private m = new Map<number, number>();\n  constructor(private cap: number) {}\n  get(key: number): number { return this.m.get(key) ?? -1; }\n  put(key: number, value: number): void { this.m.set(key, value); }\n}", "typescript", "leetcode",
    { cls: "LRUCache", ctor: ["int"], methods: { get: [["int"], "int"], put: [["int", "int"], "void"] } }, { input: [["LRUCache", "put", "get"], [[2], [1, 1], [1]]] });
  assert.deepEqual(lru.actual, [null, null, 1]);
  assert.deepEqual(vars(lru.trace.steps.at(-1)), { key: "1", "this.m": "Map(1) {1 => 1}", "this.cap": "2" }, "设计类题列出 this 的字段");

  const tight = runJs("function twoSum(nums, target) { while (true) { nums; } }", "javascript", "leetcode", TWO, { input: [[1], 1] });
  assert.equal(tight.trace.truncated, true, "同一条语句反复执行照常每次都记，记满了停下（不会卡到超时）");
  assert.match(tight.error, /最多记录 1000 步/);

  const acm = runJs('import { readFileSync } from "node:fs";\nconst n: number = Number(readFileSync(0, "utf8"));\nlet total = 0;\nfor (let k = 0; k < n; k++) total += k;\nconsole.log(total);', "typescript", "acm", {}, { stdin: "4\n" });
  assert.equal(acm.stdout, "6\n");
  assert.deepEqual(acm.trace.steps.at(-1).line, 5);

  // 全部官方题解：插桩前后答案一样
  let files = 0, cases = 0;
  const codeRoot = path.join(root, "tools/illustrations/code");
  for (const dir of fs.readdirSync(codeRoot)) {
    const data = path.join(root, "tools/practice/data", `${dir}.json`);
    if (!fs.existsSync(data)) continue;
    const problem = JSON.parse(fs.readFileSync(data, "utf8"));
    for (const f of fs.readdirSync(path.join(codeRoot, dir))) {
      const language = f.endsWith(".ts") ? "typescript" : f.endsWith(".js") ? "javascript" : null;
      if (!language) continue;
      files++;
      const raw = fs.readFileSync(path.join(codeRoot, dir, f), "utf8");
      let inst = instrument(ts, raw, language, "leetcode"), plain = raw;
      if (language === "typescript") {
        plain = toJs(raw).outputText;
        const out = toJs(inst);
        const errors = (out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
        assert.equal(errors.length, 0, `${dir}/${f} 插桩后转译出错：${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("；")}`);
        inst = out.outputText;
      }
      for (const test of problem.cases.slice(0, 6)) {
        cases++;
        const a = execute(plain, "leetcode", problem.signature, test), b = execute(inst, "leetcode", problem.signature, test, true);
        if (b.trace.truncated) continue; // 用例大、记满了步数：答案本来就没跑出来
        assert.deepEqual([b.actual, b.error], [a.actual, a.error], `${dir}/${f} 插桩前后答案不一样`);
        assert.ok(b.trace.steps.length, `${dir}/${f} 没有记录`);
      }
    }
  }
  console.log(`调试测试通过：Python 几种题型；JS / TS 官方题解 ${files} 份、${cases} 组用例插桩前后答案一致`);
}
