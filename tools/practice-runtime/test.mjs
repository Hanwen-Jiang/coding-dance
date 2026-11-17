import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { comparePracticeOutput } from "../../site/lib/practice/compare.ts";
import { parseAcmOutput } from "../../site/lib/practice/acm.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "site/package.json"));
const typescript = require("typescript");
const templates = require(path.join(root, "tools/practice/templates.cjs"));
const onlyExamples = process.argv.includes("--examples");
const onlyTemplates = process.argv.includes("--templates");
const { loadPyodide } = await import(pathToFileURL(path.join(root, "site/node_modules/pyodide/pyodide.mjs")).href);
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "site/public/practice-runtime/kernel.js"), "utf8"), context);
const execute = context.PracticeKernel.executeJavaScript;
const kernelSource = fs.readFileSync(path.join(root, "site/public/practice-runtime/kernel.js"), "utf8");
const pythonSource = fs.readFileSync(path.join(root, "site/public/practice-runtime/python-runner.py"), "utf8");
const python = await loadPyodide({ indexURL: path.join(root, "site/node_modules/pyodide/"), stdout: () => {}, stderr: () => {} });
python.runPython(pythonSource);
function executePython(code, mode, signature, test) {
  python.globals.set("__practice_request_json", JSON.stringify({ code, mode, signature, test }));
  return JSON.parse(python.runPython("__practice_run(__practice_request_json)"));
}

assert.equal(comparePracticeOutput({ id: 1, signature: {} }, { input: [[3, 3], 6], expected: [0, 1] }, [1, 0]), true);
assert.equal(comparePracticeOutput({ id: 1, signature: {} }, { input: [[3, 3], 6], expected: [0, 1] }, [0, 0]), false);
assert.equal(comparePracticeOutput({ id: 5, signature: {} }, { input: ["babad"], expected: "bab" }, "aba"), true);
assert.equal(comparePracticeOutput({ id: 5, signature: {} }, { input: ["babad"], expected: "bab" }, "bad"), false);
assert.equal(comparePracticeOutput({ id: 46, signature: {} }, { input: [[1, 2]], expected: [[1, 2], [2, 1]] }, [[1, 2], [1, 2]]), false);
assert.equal(comparePracticeOutput({ id: 131, signature: { cmp: "unordered" } }, { input: ["aab"], expected: [["a", "a", "b"], ["aa", "b"]] }, [["b", "a", "a"], ["b", "aa"]]), false);
assert.equal(comparePracticeOutput({ id: 108, signature: {} }, { input: [[1, 2, 3, 4]], expected: [3, 2, 4, 1] }, [2, 1, 3, null, null, null, 4]), true);
assert.equal(comparePracticeOutput({ id: 108, signature: {} }, { input: [[1, 2, 3, 4]], expected: [3, 2, 4, 1] }, [1, null, 2, null, 3, null, 4]), false);
assert.equal(comparePracticeOutput({ id: 70, signature: { ret: "int" } }, { input: [45], expected: 1836311903 }, 1836311902), false);
assert.equal(comparePracticeOutput({ id: 70, signature: { ret: "int" } }, { input: [45], expected: 1836311903 }, 1836310903), false);
assert.equal(comparePracticeOutput({ id: 4, signature: { ret: "double" } }, { input: [[1], [2]], expected: 1.5 }, 1.5000001), true);
const queens = [[".Q..", "...Q", "Q...", "..Q."], ["..Q.", "Q...", "...Q", ".Q.."]];
assert.equal(comparePracticeOutput({ id: 51, signature: {} }, { input: [4], expected: queens }, queens.slice().reverse()), true);
assert.equal(comparePracticeOutput({ id: 51, signature: {} }, { input: [4], expected: queens }, queens.map((board) => [board[1], board[0], ...board.slice(2)])), false);
assert.match(execute("this is not JavaScript", "leetcode", { fn: "solve", params: [], ret: "int" }, { input: [] }).error, /Unexpected/);
assert.match(execute("require('child_process')", "acm", {}, { stdin: "" }).error, /只支持/);
assert.equal(execute("console.log('before'); throw Error('bad')", "acm", {}, { stdin: "" }).stdout, "before\n");
assert.deepEqual(JSON.parse(JSON.stringify(execute("/** function ListNode(val, next) {} */\nfunction solve() { return new ListNode(7); }", "leetcode", { fn: "solve", params: [], ret: "ListNode" }, { input: [] }).actual)), [7]);
assert.deepEqual(JSON.parse(JSON.stringify(execute("class ListNode { constructor(val) { this.val = val; this.next = null; } }\nfunction solve() { return new ListNode(8); }", "leetcode", { fn: "solve", params: [], ret: "ListNode" }, { input: [] }).actual)), [8]);
assert.equal(execute("const fs = require('fs'); console.log(Number(fs.readFileSync(0,'utf8')) + 1)", "acm", {}, { stdin: "41\n" }).stdout, "42\n");
assert.equal(executePython("import sys\nprint(int(sys.stdin.read()) + 1)", "acm", {}, { stdin: "41\n" }).stdout, "42\n");
assert.match(executePython("raise ValueError('example')", "acm", {}, { stdin: "" }).error, /ValueError/);
assert.equal(execute("console.log(42); process.exit(0); throw Error('unreachable');", "acm", {}, { stdin: "" }).stdout, "42\n");
assert.ok(!execute("console.log(42); process.exit(0);", "acm", {}, { stdin: "" }).error);
assert.match(execute("process.exit(1);", "acm", {}, { stdin: "" }).error, /状态码 1/);
assert.ok(!executePython("import sys\nprint(42)\nsys.exit(0)\nraise Exception('unreachable')", "acm", {}, { stdin: "" }).error);
assert.match(executePython("import sys\nsys.exit(1)", "acm", {}, { stdin: "" }).error, /SystemExit: 1/);

// These are complete ACM programs: they read stdin and write stdout themselves,
// without receiving a solve callback, parser helper or prefilled algorithm.
const completePrograms = {
  javascript: `const fs = require("fs");
const tokens = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
const n = tokens[0], nums = tokens.slice(1, n + 1), target = tokens[n + 1];
const seen = new Map();
for (let i = 0; i < n; i++) { if (seen.has(target - nums[i])) { process.stdout.write("2\\n" + seen.get(target - nums[i]) + " " + i + "\\n"); process.exit(0); } seen.set(nums[i], i); }
`,
  typescript: `import { readFileSync } from "node:fs";
const tokens: number[] = readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
const n: number = tokens[0], nums: number[] = tokens.slice(1, n + 1), target: number = tokens[n + 1];
const seen = new Map<number, number>();
for (let i = 0; i < n; i++) { if (seen.has(target - nums[i])) { console.log(2); console.log(seen.get(target - nums[i]), i); break; } seen.set(nums[i], i); }
`,
  python: `import sys
tokens = list(map(int, sys.stdin.read().split()))
n = tokens[0]
nums, target = tokens[1:n + 1], tokens[n + 1]
seen = {}
for i, value in enumerate(nums):
    if target - value in seen:
        print(2)
        print(seen[target - value], i)
        sys.exit(0)
    seen[value] = i
`,
};
for (const [language, source] of Object.entries(completePrograms)) {
  const code = language === "typescript" ? typescript.transpileModule(source, { compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.None } }).outputText : source;
  const test = { input: [[2, 7, 11, 15], 9], stdin: "4\n2 7 11 15\n9\n", expected: [0, 1] };
  const result = language === "python" ? executePython(code, "acm", {}, test) : execute(code, "acm", {}, test);
  assert.ok(!result.error, `${language} complete ACM program: ${result.error}`);
  assert.deepEqual(parseAcmOutput(result.stdout, { params: ["int[]", "int"], ret: "int[]" }), [0, 1]);
}
if (process.argv.includes("--smoke")) {
  console.log("Runtime smoke checks passed: complete Python/JavaScript/TypeScript ACM programs, Node fs imports, normal/nonzero exits, node helpers and alternative-answer comparison.");
  process.exit(0);
}

let problemCount = 0, caseCount = 0, templateCount = 0, languageCount = { javascript: 0, typescript: 0, python: 0 }, acmCount = { javascript: 0, typescript: 0, python: 0 }, fixtureCount = { javascript: 0, typescript: 0 };

// References for 50 original problems have no JS/TS translation. For these only,
// fixed fixtures assert typed input construction and output serialization without
// pretending to verify another implementation of the actual algorithm.
function javascriptFixture(signature, test) {
  const helpers = `
function __asInput(t, v) {
  if (t === "ListNode") { const out=[]; for(let p=v;p;p=p.next) out.push(p.val); return out; }
  if (t === "ListNode[]") return v.map(x=>__asInput("ListNode",x));
  if (t === "TreeNode") {const out=[],q=[v];for(let i=0;i<q.length;i++){const n=q[i];if(!n){out.push(null);continue;}out.push(n.val);q.push(n.left,n.right);}while(out.length&&out[out.length-1]===null)out.pop();return out;}
  return v;
}
function __asOutput(t,v) {
  if(t === "ListNode"){const d=new ListNode();let p=d;for(const x of v)p=p.next=new ListNode(x);return d.next;}
  if(t === "TreeNode"){if(!v.length)return null;const root=new TreeNode(v[0]),q=[root];let i=1;for(let h=0;h<q.length&&i<v.length;h++)for(const side of ["left","right"]){if(i>=v.length)break;const x=v[i++];if(x!==null)q.push(q[h][side]=new TreeNode(x));}return root;}
  return v;
}
`;
  if (signature.cls) {
    return helpers + `class ${signature.cls} { constructor(...args) { this.index=0; this.expected=${JSON.stringify(test.expected)}; } ${Object.entries(signature.methods).map(([name, [, ret]]) => `${name}(...args) { return __asOutput(${JSON.stringify(ret)},this.expected[++this.index]); }`).join(" ")} }`;
  }
  return helpers + `function ${signature.fn}(...args) { const sig=${JSON.stringify(signature)}; if(JSON.stringify(args.map((v,i)=>__asInput(sig.params[i],v)))!==${JSON.stringify(JSON.stringify(test.input))}) throw Error("输入适配错误"); const expected=${JSON.stringify(test.expected)}; ${signature.ret === "void" ? `args[${signature.out || 0}].splice(0,args[${signature.out || 0}].length,...expected);` : `return __asOutput(${JSON.stringify(signature.ret)},expected);`} }`;
}
const practicePath = path.join(root, "site/public/practice");
const generated = fs.existsSync(practicePath) ? fs.readdirSync(practicePath).filter((f) => /^\d+\.json$/.test(f)).sort() : [];
const files = generated.length === 100 ? generated : [];
const dataFiles = files.length ? files : fs.readdirSync(path.join(root, "tools/illustrations/cases")).filter((f) => f.endsWith(".json")).sort();
for (const file of dataFiles) {
  const id = Number(file.replace(".json", ""));
  const reference = JSON.parse(fs.readFileSync(path.join(root, "tools/illustrations/data", String(id).padStart(4, "0") + ".json"), "utf8"));
  let problem;
  if (files.length) problem = JSON.parse(fs.readFileSync(path.join(practicePath, file), "utf8"));
  else {
    const raw = JSON.parse(fs.readFileSync(path.join(root, "tools/illustrations/cases", file), "utf8"));
    problem = { id, signature: raw.sig, cases: raw.cases.map((c) => ({ input: c.in, expected: c.out, stdin: "" })) };
  }
  problemCount++;
  const selectedCases = onlyExamples ? problem.examples : problem.cases;
  assert.ok(selectedCases?.length, `${id}: ${onlyExamples ? "official examples" : "cases"} required`);
  for (const language of ["javascript", "typescript", "python"]) {
    if (files.length) for (const mode of ["leetcode", "acm"]) {
      let starter = problem.starters[mode][language];
      if (mode === "acm") {
        assert.equal(starter, "", `${id} ${language}: ACM must start strictly empty, without even a newline`);
        const knownPrevious = new Set([problem.legacyAcmStarterHashes?.[language], ...(problem.previousAcmStarterHashes?.[language] ?? [])]);
        for (const previousTemplate of [templates.legacyAcmTemplate, templates.previousAcmTemplate]) {
          const previous = previousTemplate(problem.signature, problem.parameterNames, language);
          assert.ok(knownPrevious.has(templates.starterHash(previous)), `${id} ${language}: untouched previous starter must be migratable`);
          assert.ok(!knownPrevious.has(templates.starterHash(previous + "\n// user-edited")), `${id} ${language}: edited prior starter must stay outside automatic migration`);
        }
      }
      if (language === "typescript") starter = typescript.transpileModule(starter, { compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.None } }).outputText;
      const result = language === "python" ? executePython(starter, mode, problem.signature, selectedCases[0]) : execute(starter, mode, problem.signature, selectedCases[0]);
      if (mode === "leetcode") assert.match(result.error || "", /请完成/, `${id} ${language} ${mode} template should parse/construct inputs and reach its blank method: ${result.error}`);
      else {
        assert.ok(!result.error, `${id} ${language} empty ACM program should execute without code injection: ${result.error}`);
        assert.equal(result.stdout, "", `${id} ${language} empty ACM program must have no output`);
        assert.equal(result.actual, null, `${id} ${language} empty ACM program must not get a supplied answer`);
      }
      templateCount++;
    }
    if (onlyTemplates) continue;
    const entry = reference.codes.find((c) => language === "python" ? c.code : c.langs?.[language]?.code);
    // Half of the original resource repository has Python references only.
    // Their three-language templates are still executed above; do not invent algorithm evidence.
    if (!entry) {
      for (const test of selectedCases) {
        const fixture = javascriptFixture(problem.signature, test);
        const compiled = language === "typescript" ? typescript.transpileModule(fixture, { compilerOptions: { target: typescript.ScriptTarget.ES2022 } }).outputText : fixture;
        const result = execute(compiled, "leetcode", problem.signature, test);
        assert.ok(!result.error, `${id} ${language} typed fixture: ${result.error}`);
        assert.ok(comparePracticeOutput(problem, test, result.actual), `${id} ${language} output adapter`);
        const acm = compiled + `\nfunction solve(...args) { const result = globalThis.PracticeKernel.executeJavaScript(${JSON.stringify(compiled)}, "leetcode", ${JSON.stringify(problem.signature)}, {input:args}); if(result.error)throw Error(result.error);return result.actual; }\n`;
        // The ACM wrapper calls the exact same fixture with decoded stdin values.
        const acmResult = execute(kernelSource + "\n" + acm + templates.javascriptPrelude(problem.signature) + templates.javascriptEpilogue(problem.signature), "acm", problem.signature, test);
        assert.ok(!acmResult.error, `${id} ${language} ACM typed fixture: ${acmResult.error}`);
        assert.ok(comparePracticeOutput(problem, test, parseAcmOutput(acmResult.stdout, problem.signature)), `${id} ${language} ACM output adapter`);
        fixtureCount[language] += 2;
      }
      continue;
    }
    let code = language === "python" ? entry.code : entry.langs[language].code;
    if (language === "typescript") code = typescript.transpileModule(code, { compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.None } }).outputText;
    let acmCode;
    if (files.length) {
      const sigText = JSON.stringify(problem.signature), codeText = JSON.stringify(code);
      if (language === "python") {
        acmCode = pythonSource + `\nimport json as _ref_json\ndef solve(*args):\n    request = {"code": ${codeText}, "signature": _ref_json.loads(${JSON.stringify(sigText)}), "mode": "leetcode", "test": {"input": args}}\n    result = _ref_json.loads(__practice_run(_ref_json.dumps(request)))\n    if result.get("error"): raise RuntimeError(result["error"])\n    return result["actual"]\n` + templates.pythonPrelude(problem.signature) + templates.pythonEpilogue(problem.signature);
      } else {
        acmCode = kernelSource + `\nfunction solve(...args) { const result = globalThis.PracticeKernel.executeJavaScript(${codeText}, "leetcode", ${sigText}, {input:args}); if (result.error) throw Error(result.error); return result.actual; }\n` + templates.javascriptPrelude(problem.signature) + templates.javascriptEpilogue(problem.signature);
      }
    }
    for (const test of selectedCases) {
      const result = language === "python" ? executePython(code, "leetcode", problem.signature, test) : execute(code, "leetcode", problem.signature, test);
      assert.ok(!result.error, `${id} ${language}: ${result.error}`);
      assert.ok(comparePracticeOutput(problem, test, result.actual), `${id} ${language}: expected ${JSON.stringify(test.expected)}, got ${JSON.stringify(result.actual)}`);
      languageCount[language]++;
      if (acmCode) {
        const acmResult = language === "python" ? executePython(acmCode, "acm", problem.signature, test) : execute(acmCode, "acm", problem.signature, test);
        assert.ok(!acmResult.error, `${id} ${language} ACM: ${acmResult.error}`);
        const actual = parseAcmOutput(acmResult.stdout, problem.signature);
        assert.ok(comparePracticeOutput(problem, test, actual), `${id} ${language} ACM: expected ${JSON.stringify(test.expected)}, got ${JSON.stringify(actual)}`);
        acmCount[language]++;
      }
    }
  }
  caseCount += onlyTemplates ? 0 : selectedCases.length;
}
console.log(JSON.stringify({ scope: onlyTemplates ? "templates and two-generation migration fingerprints" : onlyExamples ? "official examples" : "all cases", problems: problemCount, cases: caseCount, blankTemplatesExecuted: templateCount, completeAcmProgramsExecuted: 3, referenceLeetcodeExecutions: languageCount, referenceAcmExecutions: acmCount, remainingProblemsTypedFixtureExecutions: fixtureCount, runtime: "actual Pyodide + JavaScript VM + TypeScript compiler" }, null, 2));
