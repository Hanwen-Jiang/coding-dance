// 判题器的公共部分：类型、函数签名、结果比较、跑子进程。
const cp = require("child_process");

/**
 * 类型的写法（和语言无关）：
 *   int long double bool string char ListNode TreeNode
 *   T[]      数组（Java 里是 T[]）
 *   List<T>  列表（Java 里是 List<T>；其他语言和数组一样）
 */
function parseType(s) {
  s = String(s).trim();
  if (s.endsWith("[]")) return { arr: parseType(s.slice(0, -2)), list: false, src: s };
  const m = s.match(/^List<(.+)>$/);
  if (m) return { arr: parseType(m[1]), list: true, src: s };
  if (!["int", "long", "double", "bool", "string", "char", "ListNode", "TreeNode", "void"].includes(s)) throw new Error(`不认识的类型：${s}`);
  return { base: s, src: s };
}

/**
 * 签名的两种写法：
 *   函数：{ fn: "twoSum", params: ["int[]", "int"], ret: "int[]" }
 *         原地修改的题：ret 写 "void"，out 写要检查的参数下标（默认 0）
 *   设计类：{ cls: "LRUCache", ctor: ["int"], methods: { get: [["int"], "int"], put: [["int", "int"], "void"] } }
 *         用例的输入是 [操作名数组, 参数数组]，第一个操作是类名（构造函数），和力扣的写法一样
 * 可选 cmp："unordered" 忽略列表顺序，"length" 只比长度（答案不唯一的题）
 */
function normSig(sig) {
  if (sig.cls) {
    const methods = {};
    for (const [name, [ps, ret]] of Object.entries(sig.methods)) methods[name] = { params: ps.map(parseType), ret: parseType(ret) };
    return { kind: "design", cls: sig.cls, ctor: (sig.ctor || []).map(parseType), methods, cmp: sig.cmp || null };
  }
  const ret = parseType(sig.ret);
  return { kind: "fn", fn: sig.fn, params: sig.params.map(parseType), ret, out: ret.base === "void" ? sig.out || 0 : null, cmp: sig.cmp || null };
}

/** 给各语言的运行脚本看的签名：类型都写回字符串 */
const flatSig = (sig) => (sig.kind === "design"
  ? { kind: "design", cls: sig.cls, ctor: sig.ctor.map((t) => t.src), methods: Object.fromEntries(Object.entries(sig.methods).map(([k, m]) => [k, { params: m.params.map((t) => t.src), ret: m.ret.src }])) }
  : { kind: "fn", fn: sig.fn, params: sig.params.map((t) => t.src), ret: sig.ret.src, out: sig.out });

const deepSort = (x) => (Array.isArray(x) ? x.map(deepSort).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) : x);
/** 期望是数组而实际是 null 时算作空数组（Go 的空切片序列化出来是 null） */
const fill = (exp, got) => {
  if (Array.isArray(exp)) {
    if (got === null || got === undefined) return [];
    if (Array.isArray(got)) return got.map((g, i) => fill(exp[Math.min(i, exp.length - 1)], g));
  }
  return got === undefined ? null : got;
};
const same = (a, b) => {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-5;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  return JSON.stringify(a) === JSON.stringify(b);
};
function matches(exp, got, cmp) {
  if (got && typeof got === "object" && !Array.isArray(got) && "__error" in got) return false;
  got = fill(exp, got);
  if (cmp === "length") return (got ? got.length : -1) === (exp ? exp.length : -1);
  if (cmp === "unordered") return same(deepSort(exp), deepSort(got));
  return same(exp, got);
}

/** 跑一个命令，不抛异常，返回 { code, stdout, stderr, timedOut } */
function run(cmd, args, { cwd, timeout = 30000 } = {}) {
  return new Promise((resolve) => {
    cp.execFile(cmd, args, { cwd, timeout, maxBuffer: 64 << 20, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout: String(stdout || ""), stderr: String(stderr || ""), timedOut: !!(err && err.killed) });
    });
  });
}
/** 同时最多跑 n 个 */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}
/** 本机有没有这个命令 */
function hasTool(cmd, args = ["--version"]) {
  try {
    const r = cp.spawnSync(cmd, args, { stdio: "ignore", windowsHide: true });
    return !r.error && r.status === 0;
  } catch { return false; }
}
/** 程序每个用例输出一行 JSON；行数不够的补成错误 */
function parseLines(stdout, n, extra) {
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim() !== "");
  const out = [];
  for (let i = 0; i < n; i++) {
    if (i >= lines.length) { out.push({ __error: extra || "没有输出（程序提前退出了）" }); continue; }
    try { out.push(JSON.parse(lines[i])); } catch { out.push({ __error: `输出不是 JSON：${lines[i].slice(0, 200)}` }); }
  }
  return out;
}
const cores = Math.max(2, Math.min(8, require("os").cpus().length));

module.exports = { parseType, normSig, flatSig, deepSort, matches, run, pool, hasTool, parseLines, cores };
