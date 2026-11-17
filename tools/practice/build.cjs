// Rebuild browser practice data from the checked-in problems/specs and judge fixtures.
// Run from repository root: node tools/practice/build.cjs
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), cp = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { normSig } = require("../illustrations/judge/util");
const pyJudge = require("../illustrations/judge/langs/python");
const { parseCode } = require("../illustrations/judge/code");
const { GEN, makeR } = require("../illustrations/random");
const descriptions = require("./descriptions.cjs"), boundaries = require("./boundaries.cjs");
const { leetcodeTemplate, acmTemplate, legacyAcmTemplate, previousAcmTemplate, starterHash } = require("./templates.cjs");
const root = path.resolve(__dirname, "../.."), output = path.join(root, "site/public/practice");
const pad = (id) => String(id).padStart(4, "0");
const clone = (v) => JSON.parse(JSON.stringify(v));
const aliases = {
  2: ["x", "y"], 4: ["A", "B"], 17: ["d"], 19: ["v", "n"], 21: ["x", "y"], 23: ["ls"],
  39: ["c", "target"], 54: ["m"], 56: ["iv"], 74: ["M", "target"], 84: ["h"], 94: ["t"], 98: ["t"],
  101: ["t"], 104: ["t"], 105: ["pre", "ino"], 118: ["n"], 124: ["t"], 148: ["v"],
  226: ["t"], 234: ["v"], 543: ["t"]
};
const designs = {
  155: { cls: "MinStack", ctor: [], methods: { push: [["int"], "void"], pop: [[], "void"], top: [[], "int"], getMin: [[], "int"] } },
  208: { cls: "Trie", ctor: [], methods: { insert: [["string"], "void"], search: [["string"], "bool"], startsWith: [["string"], "bool"] } },
  295: { cls: "MedianFinder", ctor: [], methods: { addNum: [["int"], "void"], findMedian: [[], "double"] } }
};
const unordered = new Set([15, 17, 22, 39, 46, 49, 51, 78, 131, 347]);

function splitParams(s) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if ("[(".includes(s[i])) depth++;
    if ("])".includes(s[i])) depth--;
    if (s[i] === "," && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
  }
  out.push(s.slice(start).trim());
  return out.filter((x) => x && x !== "self");
}
function typeFromPython(type) {
  const t = type.trim();
  if (t.startsWith("Optional[")) return typeFromPython(t.slice(9, -1));
  if (t.startsWith("List[")) return `${typeFromPython(t.slice(5, -1))}[]`;
  return ({ str: "string", float: "double", None: "void" })[t] || t;
}
function method(code, name) {
  const re = name ? new RegExp(`^    def ${name}\\(([^\\n]*)\\)(?: -> ([^:\\n]+))?:`, "m") : /^    def (\w+)\(([^\n]*)\)(?: -> ([^:\n]+))?:/m;
  const m = code.match(re);
  if (!m) throw new Error(`Cannot read Python method ${name || "Solution"}`);
  const fn = name || m[1], params = splitParams(m[name ? 1 : 2]);
  return { fn, names: params.map((p) => p.split(":")[0].trim()), params: params.map((p) => typeFromPython(p.split(":").slice(1).join(":"))), ret: typeFromPython(m[name ? 2 : 3] || "None") };
}
function signatureFor(s) {
  if (s.sig) return clone(s.sig);
  if (designs[s.id]) return clone(designs[s.id]);
  const m = method(s.codes[0].code);
  return { fn: m.fn, params: m.params, ret: m.ret, ...(unordered.has(s.id) ? { cmp: "unordered" } : {}) };
}
function presetInput(s, sig, args) {
  if (sig.cls) {
    const ops = args.ops.map(([name, ...a]) => [s.id === 295 ? ({ add: "addNum", find: "findMedian" })[name] || name : name, a]);
    return [[sig.cls, ...ops.map(([n]) => n)], [[], ...ops.map(([, a]) => a)]];
  }
  if (s.id === 240) return [[[1, 4, 7, 11, 15], [2, 5, 8, 12, 19], [3, 6, 9, 16, 22], [10, 13, 14, 17, 24], [18, 21, 23, 26, 30]], args.t];
  if (s.call) return s.call(args, makeR());
  const names = aliases[s.id] || method(s.codes[0].code, sig.fn).names;
  return names.map((name, i) => {
    if (!(name in args)) throw new Error(`${s.id}: no preset argument ${name} (keys: ${Object.keys(args)})`);
    return sig.params[i] === "TreeNode" ? makeR().toLc(args[name]) : args[name];
  });
}

function formatType(type, isOutput = false) {
  const array = type.endsWith("[]") ? type.slice(0, -2) : /^List<(.+)>$/.exec(type)?.[1];
  const scalar = { int: "整数", long: "整数", double: "实数", bool: "布尔值 true 或 false", string: "字符串（占完整一行，不加引号，空串用空行）", char: "字符", TreeRef: "树中已有节点的值", NodeIndex: "节点下标（从 0 开始，无节点时为 -1）", TreeVal: "节点值（无节点时为 null）" };
  if (scalar[type]) return scalar[type];
  if (type === "ListNode") return "节点值序列：先一行节点数 n；n > 0 时下一行给出 n 个空格分隔的整数，n = 0 时没有元素行";
  if (type === "TreeNode") return "二叉树层序序列：先一行序列长度 n；n > 0 时下一行给出 n 个空格分隔的节点值或 null。按队列从左到右分配每个非空节点的左右孩子，末尾多余 null 可省略；空树写 0";
  if (type === "CycleList") return "先读节点值序列（节点数 n 一行，n > 0 时下一行 n 个整数），再读一行 pos；尾节点指向下标 pos，pos = -1 表示不成环";
  if (type === "JoinList") return "第二条链表的独有前缀：先读前缀节点数 n，n > 0 时下一行 n 个整数；再一行给出共享后缀在第一条链表中的起点下标 k，k = -1 表示不相交";
  if (type === "RandomList") return "先一行节点数 n，之后 n 行每行两个整数 val randomIndex；randomIndex 从 0 开始，-1 表示 random 为空，next 按输入次序连接";
  if (array) {
    const nested = array.endsWith("[]") || array.startsWith("List<") || array === "ListNode";
    if (nested) return `先一行外层序列的长度 r；之后依次给出 r 个子序列，每个子序列按以下规则独立编码：${formatType(array, isOutput)}`;
    if (array === "string") return "先一行字符串数量 n，之后 n 行每行一个字符串，不加引号；空字符串占一空行，n = 0 时没有字符串行";
    return `先一行元素个数 n；n > 0 时下一行给出 n 个空格分隔的${formatType(array, isOutput)}，n = 0 时没有元素行`;
  }
  throw new Error(`Undocumented type: ${type}`);
}

const plain = (html) => html.replace(/<sup>(.*?)<\/sup>/gi, "^$1").replace(/<sub>(.*?)<\/sub>/gi, "_$1").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
function constraints(s) {
  const f = fs.readdirSync(path.join(root, "problems")).find((f) => f.startsWith(pad(s.id) + ".") && f.endsWith(".md"));
  if (!f) return [];
  const text = fs.readFileSync(path.join(root, "problems", f), "utf8").split("## 思路图解")[0];
  const start = text.lastIndexOf("提示：</strong>");
  return start < 0 ? [] : [...text.slice(start).matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => `数据范围：${plain(m[1])}`);
}

function statement(s, sig, names, examples, methodNames) {
  const notes = ["每次运行只处理一组数据，不需要读取测试组数 T。", ...constraints(s)];
  let input, outputText;
  if (sig.cls) {
    input = `第一行输入操作数 q，之后 q 行每行一个操作。第一条必须是构造操作 ${sig.cls}${(sig.ctor || []).map((_, i) => ` ${sig.cls === "LRUCache" ? "capacity" : `arg${i + 1}`}`).join("")}。其余操作为：\n` + Object.entries(sig.methods).map(([method, [params]]) => `${method}${params.map((_, i) => " " + (methodNames[method]?.[i] || `arg${i + 1}`)).join("")}`).join("\n") + "\n参数与操作名使用空格分隔，字符串不加引号。";
    outputText = "输出 q 行，与输入操作一一对应。构造操作和没有返回值的操作输出 null；查询操作输出查询结果，布尔值写 true 或 false。";
  } else {
    input = "依次读取以下参数，各参数从新的一行开始：\n" + sig.params.map((t, i) => `${i + 1}. ${names[i]}：${formatType(t)}。`).join("\n");
    const ret = sig.ret === "void" ? sig.params[sig.out || 0] : sig.ret;
    outputText = `${sig.ret === "void" ? `输出修改后的 ${names[sig.out || 0]}。` : "输出题目要求的结果。"}格式为：${formatType(ret, true)}。`;
    if (sig.ret === "void") notes.push("LeetCode 模式检查原参数的修改结果；ACM 模式请将最终结果按输出格式写到标准输出。");
    if (s.id === 108) notes.push("答案不唯一，任意节点值正确且高度平衡的二叉搜索树都可通过。");
    if (s.id === 5 || s.id === 76) notes.push("最优子串可能不唯一，测试会验证子串合法性及最优长度。");
    if (unordered.has(s.id)) notes.push(s.id === 131 ? "分割方案之间的顺序不限，同一方案内片段顺序必须保持不变。" : s.id === 46 || s.id === 51 ? "完整方案之间的输出顺序不限，每个方案内部的排列或棋盘行次序必须正确。" : "输出集合的排列顺序不限，不得遗漏或重复答案。");
    if (sig.params.some((t) => /Node|List|Tree/.test(t))) notes.push("ACM 使用上述序列格式表示链表或二叉树，程序需自行读取输入并处理这些结构。LeetCode 模式由测试环境建立节点。");
  }
  return { description: descriptions[s.id], input, output: outputText, notes, examples: examples.map((c) => ({ input: c.stdin, output: c.stdout, explanation: `${c.label}：由原题对应示例改写，所有序列长度和节点下标均按上述格式编码。` })) };
}

function officialInput(id, signature, example) {
  const f = example.fields;
  if (id === 141 || id === 142) return [[f.head, f.pos]];
  if (id === 160) return [f.listA, [f.intersectVal === 0 ? f.listB : f.listB.slice(0, f.skipB), f.intersectVal === 0 ? -1 : f.skipA]];
  const result = example.values;
  if (signature.cls) {
    if (result.length !== 2 || result[0][0] !== signature.cls || result[0].length !== result[1].length) throw new Error(`${id}: invalid official design example`);
  } else if (result.length !== signature.params.length) throw new Error(`${id}: official example arity mismatch`);
  return result;
}
function officialExpected(id, example) {
  if (example.hasOutputValue) return example.outputValue;
  if (id === 142) {
    const index = /索引为\s*(\d+)/.exec(example.outputText);
    if (index) return Number(index[1]);
    if (/null/.test(example.outputText)) return null;
  }
  if (id === 160) return example.fields.intersectVal === 0 ? null : example.fields.skipA;
  throw new Error(`${id}: official example output cannot be verified`);
}

async function main() {
  const { encodeAcmInput, decodeAcmInput, encodeAcmOutput, parseAcmOutput } = await import(pathToFileURL(path.join(root, "site/lib/practice/acm.ts")).href);
  const { comparePracticeOutput } = await import(pathToFileURL(path.join(root, "site/lib/practice/compare.ts")).href);
  const official = JSON.parse(cp.execFileSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"), [path.join(__dirname, "official-examples.py")], { encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" }, windowsHide: true }));
  fs.mkdirSync(output, { recursive: true });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hot100-practice-data-"));
  const files = fs.readdirSync(path.join(root, "tools/illustrations/specs")).filter((f) => /^\d+\.js$/.test(f));
  let total = 0, officialTotal = 0;
  try {
    for (const file of files) {
      const s = require(path.join(root, "tools/illustrations/specs", file)), sig = signatureFor(s);
      if (!descriptions[s.id] || !boundaries[s.id]) throw new Error(`${s.id}: missing authored statement or boundary case`);
      if (unordered.has(s.id)) sig.cmp = "unordered";
      const python = parseCode(s.codes[0].code).code;
      const names = sig.cls ? ["operations", "arguments"] : method(python, sig.fn).names;
      const methodNames = sig.cls ? Object.fromEntries(Object.keys(sig.methods).map((n) => [n, method(python, n).names])) : {};
      const inputs = [], seen = new Set();
      const add = (value, label) => {
        const key = JSON.stringify(value);
        if (!seen.has(key)) { seen.add(key); inputs.push({ input: clone(value), label }); }
        else if (label.startsWith("边界")) inputs.find((c) => JSON.stringify(c.input) === key).label += " · 边界";
      };
      const officialExamples = official[s.id];
      if (!officialExamples?.length) throw new Error(`${s.id}: missing official examples`);
      officialExamples.forEach((example) => add(officialInput(s.id, sig, example), `示例 ${example.index}`));
      const existing = path.join(root, "tools/illustrations/cases", pad(s.id) + ".json");
      if (fs.existsSync(existing)) JSON.parse(fs.readFileSync(existing, "utf8")).cases.forEach((c, i) => add(c.in, `仓库判题用例 ${i + 1}`));
      else {
        (s.presets || []).forEach((p, i) => add(presetInput(s, sig, p.args), `题目预设 ${i + 1} · ${p.label || "示例"}`));
        if (GEN[s.id]) {
          const orig = Math.random; let seed = s.id * 2654435761 >>> 0;
          Math.random = () => { seed = Math.imul(seed, 1664525) + 1013904223 >>> 0; return seed / 4294967296; };
          try { for (let i = 0; i < 10; i++) add(presetInput(s, sig, GEN[s.id](makeR()).args), `固定随机用例 ${i + 1}`); }
          finally { Math.random = orig; }
        }
      }
      boundaries[s.id].forEach((c, i) => add(c, `边界用例 ${i + 1}`));
      const expected = pyJudge.runSync({ name: pad(s.id), sig: normSig(sig), cases: inputs.map((c) => c.input), code: python }, temp);
      expected.forEach((v, i) => { if (v && typeof v === "object" && "__error" in v) throw new Error(`${s.id} ${inputs[i].label}: ${v.__error}`); });
      const examples = officialExamples.map((example) => {
        const input = officialInput(s.id, sig, example), out = officialExpected(s.id, example);
        const actual = expected[inputs.findIndex((c) => JSON.stringify(c.input) === JSON.stringify(input))];
        if (!comparePracticeOutput({ id: s.id, signature: sig }, { input, expected: out }, actual)) throw new Error(`${s.id} official example ${example.index}: reference disagrees with statement: ${JSON.stringify(actual)} vs ${JSON.stringify(out)}`);
        return { input, expected: out, stdin: encodeAcmInput(input, sig), stdout: encodeAcmOutput(out, sig), label: `示例 ${example.index}`, source: { path: example.path, index: example.index, input: example.inputText, output: example.outputText } };
      });
      const cases = inputs.map((c, i) => {
        const example = examples.find((e) => JSON.stringify(e.input) === JSON.stringify(c.input));
        return { ...c, ...(example ? { ...example, label: c.label } : { expected: expected[i], stdin: encodeAcmInput(c.input, sig), stdout: encodeAcmOutput(expected[i], sig) }) };
      });
      for (const c of cases) {
        if (JSON.stringify(decodeAcmInput(c.stdin, sig)) !== JSON.stringify(c.input)) throw new Error(`${s.id}: input codec roundtrip failed`);
        if (JSON.stringify(parseAcmOutput(c.stdout, sig)) !== JSON.stringify(c.expected)) throw new Error(`${s.id}: output codec roundtrip failed`);
      }
      const starters = Object.fromEntries(["leetcode", "acm"].map((mode) => [mode, Object.fromEntries(["python", "javascript", "typescript"].map((language) => [language, mode === "leetcode" ? leetcodeTemplate(sig, names, language, methodNames) : acmTemplate(sig, names, language)]))]));
      const legacyAcmStarterHashes = Object.fromEntries(["python", "javascript", "typescript"].map((language) => [language, starterHash(legacyAcmTemplate(sig, names, language))]));
      const previousAcmStarterHashes = Object.fromEntries(["python", "javascript", "typescript"].map((language) => [language, [starterHash(previousAcmTemplate(sig, names, language))]]));
      const result = { id: s.id, name: s.name, signature: sig, parameterNames: names, starters, legacyAcmStarterHashes, cases, examples, acm: statement(s, sig, names, examples, methodNames), previousAcmStarterHashes };
      fs.writeFileSync(path.join(output, pad(s.id) + ".json"), JSON.stringify(result, null, 2) + "\n");
      total += cases.length;
      officialTotal += examples.length;
      console.log(`${pad(s.id)} ${s.name}: ${cases.length} cases`);
    }
  } finally {
    // temp is returned by mkdtemp under the OS temp directory; only remove this exact child.
    if (path.dirname(temp) !== path.resolve(os.tmpdir()) || !path.basename(temp).startsWith("hot100-practice-data-")) throw new Error("Unexpected temporary directory");
    fs.rmSync(temp, { recursive: true, force: true });
  }
  console.log(`Generated ${files.length} practice problems, ${officialTotal} verified official examples, ${total} cases, and 600 starter templates.`);
}
function updateAcmStarters() {
  const files = fs.readdirSync(output).filter((f) => /^\d{4}\.json$/.test(f));
  if (files.length !== 100) throw new Error("Template-only refresh requires the complete existing 100-problem dataset");
  for (const file of files) {
    const target = path.join(output, file), problem = JSON.parse(fs.readFileSync(target, "utf8"));
    for (const language of ["python", "javascript", "typescript"]) {
      problem.starters.acm[language] = acmTemplate();
      problem.legacyAcmStarterHashes[language] = starterHash(legacyAcmTemplate(problem.signature, problem.parameterNames, language));
    }
    problem.previousAcmStarterHashes = Object.fromEntries(["python", "javascript", "typescript"].map((language) => [language, [starterHash(previousAcmTemplate(problem.signature, problem.parameterNames, language))]]));
    fs.writeFileSync(target, JSON.stringify(problem, null, 2) + "\n");
  }
  console.log("Updated 300 ACM starters to exact empty strings; retained both previous-default hash generations. Problem statements, LeetCode starters, official examples and cases were preserved.");
}
if (process.argv.includes("--templates-only")) updateAcmStarters();
else main().catch((e) => { console.error(e); process.exitCode = 1; });
