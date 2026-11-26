import type { PracticeSignature } from "./types";

export interface AcmSolutionResult {
  code: string;
  tips: string[];
}

function itemType(t: string): string | null {
  if (t.endsWith("[]")) return t.slice(0, -2);
  return /^List<(.+)>$/.exec(t)?.[1] ?? null;
}

function outType(sig: PracticeSignature): string {
  return sig.ret === "void" ? sig.params?.[sig.out ?? 0] ?? "void" : sig.ret ?? "void";
}

function collectTypes(sig: PracticeSignature): Set<string> {
  const raw = [
    ...(sig.params ?? []),
    sig.ret ?? "",
    ...(sig.ctor ?? []),
    ...Object.values(sig.methods ?? {}).flatMap(([ps, r]) => [...ps, r]),
  ].filter(Boolean);
  const all = new Set<string>();
  const walk = (t: string) => {
    all.add(t);
    const sub = itemType(t);
    if (sub) walk(sub);
  };
  raw.forEach(walk);
  return all;
}

function detectNeeds(sig: PracticeSignature) {
  const types = collectTypes(sig);
  return {
    types,
    list: ["ListNode", "CycleList", "JoinList", "NodeIndex"].some((k) => types.has(k)),
    tree: ["TreeNode", "TreeRef", "TreeVal"].some((k) => types.has(k)),
    random: types.has("RandomList"),
    cycle: types.has("CycleList"),
    join: types.has("JoinList"),
    treeRef: types.has("TreeRef"),
    nodeIndex: types.has("NodeIndex"),
    treeVal: types.has("TreeVal"),
  };
}

function buildTips(sig: PracticeSignature, parameterNames: string[]): string[] {
  const needs = detectNeeds(sig);
  const tips: string[] = [];
  if (sig.cls) {
    tips.push(`首行读入操作数 q，随后 q 行按「操作名 参数…」读取；首条固定为构造函数 ${sig.cls}。`);
    tips.push("构造与无返回值方法输出 null，其余查询方法按行输出返回值（布尔值为 true / false）。");
  } else {
    tips.push("每次运行只处理一组用例（不读 T），定长数组先读长度 n，n = 0 时紧接着没有元素行。");
    if (needs.list && !needs.cycle && !needs.join) {
      tips.push("链表按「节点数 n + 空格分隔节点值」编码，需自行定义 ListNode 并从序列重建链表。");
    }
    if (needs.cycle) tips.push("环形链表先读节点序列再读 pos（-1 无环），输出节点下标（null 输出 -1）。");
    if (needs.join) tips.push("相交链表先读链表 A，再读链表 B 独有前缀与相交起点下标 k（-1 不相交），输出节点下标或 -1。");
    if (needs.random) tips.push("随机链表首行节点数 n，随后 n 行「val randomIdx」（random 为空用 -1）。");
    if (needs.tree) tips.push("二叉树按层序序列编码（含 null 占位）；输入参数为 TreeRef 时按节点值从树中查节点引用。");
    if (sig.ret === "void") {
      const target = parameterNames[sig.out ?? 0] ?? "arg0";
      tips.push(`原题为原地修改 void 返回，ACM 模式需将修改后的 ${target} 按规定格式打印到标准输出。`);
    }
  }
  return tips.slice(0, 3);
}

// ————— Python ACM 生成 —————

function pythonAcm(code: string, sig: PracticeSignature): string {
  const n = detectNeeds(sig);
  const needsCollections = /\b(deque|defaultdict|Counter|OrderedDict)\b/.test(code) || n.tree;
  const stdImports = [
    "import sys",
    ...(needsCollections ? ["from collections import deque, defaultdict, Counter"] : []),
    ...(/\bheapq\b/.test(code) ? ["import heapq"] : []),
    ...(/\bbisect\b/.test(code) ? ["import bisect"] : []),
    ...(/\bmath\b/.test(code) ? ["import math"] : []),
    ...(/\bfunctools\b|\bcache\b|\blru_cache\b/.test(code) ? ["import functools"] : []),
    ...(/\bitertools\b/.test(code) ? ["import itertools"] : []),
    ...(/\bre\b/.test(code) ? ["import re"] : []),
    "from typing import List, Optional, Tuple, Dict, Set",
  ];

  const defs: string[] = [];
  if (n.list) {
    defs.push(
      `class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next`,
    );
  }
  if (n.tree) {
    defs.push(
      `class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right`,
    );
  }
  if (n.random) {
    defs.push(
      `class Node:\n    def __init__(self, x: int, next: 'Node' = None, random: 'Node' = None):\n        self.val = int(x)\n        self.next = next\n        self.random = random`,
    );
  }

  const pySig = JSON.stringify(sig)
    .replace(/\bnull\b/g, "None")
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False");

  const helpers: string[] = [
    `_SIG = ${pySig}`,
    `_lines = sys.stdin.read().replace("\\r", "").split("\\n")`,
    `_at = 0`,
    `def _next():\n    global _at\n    s = _lines[_at] if _at < len(_lines) else ""\n    _at += 1\n    return s`,
    `def _item(t):\n    return t[:-2] if t.endswith("[]") else t[5:-1] if t.startswith("List<") else None`,
    `def _atom(s, t):\n    if t in ("string", "char"):\n        return s\n    if t == "bool":\n        return s in ("true", "True", "1")\n    if s == "null" or (t == "NodeIndex" and s == "-1"):\n        return None\n    return float(s) if t == "double" else int(s)`,
  ];

  if (n.list) {
    helpers.push(
      `_base_nodes = []`,
      `def _build_list(vals, keep=False):\n    nodes = [ListNode(v) for v in vals]\n    for i in range(len(nodes) - 1):\n        nodes[i].next = nodes[i + 1]\n    if keep:\n        _base_nodes.clear()\n        _base_nodes.extend(nodes)\n    return nodes[0] if nodes else None, nodes`,
      `def _dump_list(head):\n    out = []\n    while head and len(out) < 100000:\n        out.append(head.val)\n        head = head.next\n    return out`,
    );
  }
  if (n.tree) {
    helpers.push(
      `_tree_map = {}`,
      `def _build_tree(vals):\n    _tree_map.clear()\n    if not vals or vals[0] is None:\n        return None\n    root = TreeNode(vals[0])\n    _tree_map[root.val] = root\n    q = deque([root])\n    i = 1\n    while q and i < len(vals):\n        cur = q.popleft()\n        if i < len(vals) and vals[i] is not None:\n            cur.left = TreeNode(vals[i])\n            _tree_map[cur.left.val] = cur.left\n            q.append(cur.left)\n        i += 1\n        if i < len(vals) and vals[i] is not None:\n            cur.right = TreeNode(vals[i])\n            _tree_map[cur.right.val] = cur.right\n            q.append(cur.right)\n        i += 1\n    return root`,
      `def _dump_tree(root):\n    if not root:\n        return []\n    out, q = [], deque([root])\n    while q and len(out) < 100000:\n        node = q.popleft()\n        if node is None:\n            out.append(None)\n        else:\n            out.append(node.val)\n            q.append(node.left)\n            q.append(node.right)\n    while out and out[-1] is None:\n        out.pop()\n    return out`,
    );
  }
  if (n.random) {
    helpers.push(
      `def _build_random(rows):\n    nodes = [Node(v) for v, _ in rows]\n    for i, (_, r) in enumerate(rows):\n        nodes[i].next = nodes[i + 1] if i + 1 < len(nodes) else None\n        nodes[i].random = None if r is None else nodes[r]\n    return nodes[0] if nodes else None`,
      `def _dump_random(head):\n    idx = {}\n    p = head\n    while p and len(idx) < 100000:\n        idx[p] = len(idx)\n        p = p.next\n    lines, p = [], head\n    while p and len(lines) < 100000:\n        r = -1 if p.random is None else idx[p.random]\n        lines.append(f"{p.val} {r}")\n        p = p.next\n    return [str(len(lines))] + lines`,
    );
  }

  helpers.push(`def _read_tokens(cnt, item):\n    toks = []\n    while len(toks) < cnt:\n        toks.extend(_next().split())\n    return [_atom(x, item) for x in toks]`);
  helpers.push(
    `def _read(t):`,
    ...(n.list ? [
      `    if t == "ListNode":\n        return _build_list(_read("int[]"), keep=True)[0]`,
      `    if t == "CycleList":\n        vals = _read("int[]")\n        pos = _read("int")\n        head, nodes = _build_list(vals, keep=True)\n        if nodes and pos >= 0:\n            nodes[-1].next = nodes[pos]\n        return head`,
      `    if t == "JoinList":\n        vals = _read("int[]")\n        k = _read("int")\n        head, nodes = _build_list(vals)\n        if k >= 0 and _base_nodes:\n            if nodes:\n                nodes[-1].next = _base_nodes[k]\n            else:\n                head = _base_nodes[k]\n        return head`,
    ] : []),
    ...(n.tree ? [
      `    if t == "TreeNode":\n        return _build_tree(_read("nullable-int[]"))`,
      `    if t == "TreeRef":\n        return _tree_map[_read("int")]`,
    ] : []),
    ...(n.random ? [
      `    if t == "RandomList":\n        rows = []\n        for _ in range(int(_next())):\n            v, r = map(int, _next().split())\n            rows.append([v, None if r == -1 else r])\n        return _build_random(rows)`,
    ] : []),
    `    item = _item(t)\n    if item is None:\n        return _atom(_next(), t)\n    cnt = int(_next())\n    if item in ("int", "long", "double", "bool", "char", "nullable-int"):\n        return _read_tokens(cnt, item)\n    return [_read(item) for _ in range(cnt)]`,
  );

  helpers.push(
    `def _text(v, t=""):\n    if v is None:\n        return "-1" if t == "NodeIndex" else "null"\n    if isinstance(v, bool):\n        return "true" if v else "false"\n    return str(v)`,
    `def _format(v, t):`,
    ...(n.list ? [
      `    if t == "ListNode":\n        return _format(_dump_list(v), "int[]")`,
      `    if t == "NodeIndex":\n        return [str(_base_nodes.index(v)) if v in _base_nodes else "-1"]`,
    ] : []),
    ...(n.tree ? [
      `    if t == "TreeNode":\n        return _format(_dump_tree(v), "nullable-int[]")`,
      `    if t == "TreeVal":\n        return ["null" if v is None else str(v.val)]`,
    ] : []),
    ...(n.random ? [
      `    if t == "RandomList":\n        return _dump_random(v)`,
    ] : []),
    `    item = _item(t)\n    if item:\n        if item in ("int", "long", "double", "bool", "char", "nullable-int"):\n            return [str(len(v))] + ([" ".join(_text(x) for x in v)] if v else [])\n        return [str(len(v))] + [line for x in v for line in _format(x, item)]\n    return [_text(v, t)]`,
  );

  let runner = "";
  if (sig.cls) {
    runner = `if __name__ == "__main__":
    q = int(_next())
    obj = None
    out = []
    for i in range(q):
        op, *vals = _next().split()
        types = _SIG["ctor"] if i == 0 else _SIG["methods"][op][0]
        args = [_atom(v, t) for v, t in zip(vals, types)]
        if i == 0:
            obj = ${sig.cls}(*args)
            out.append("null")
        else:
            res = getattr(obj, _SIG.get("pythonMethods", {}).get(op, op))(*args)
            out.append(_text(res))
    sys.stdout.write("\\n".join(out) + "\\n")`;
  } else {
    const pyFn = sig.pythonFn || sig.fn;
    const ret = outType(sig);
    runner = `if __name__ == "__main__":
    args = [_read(t) for t in _SIG["params"]]
    res = Solution().${pyFn}(*args)
    ans = ${sig.ret === "void" ? `args[${sig.out ?? 0}]` : "res"}
    sys.stdout.write("\\n".join(_format(ans, ${JSON.stringify(ret)})) + "\\n")`;
  }

  return [
    ...stdImports,
    ...(defs.length ? ["\n# —— 数据结构定义 ——", ...defs] : []),
    "\n# —— 核心解法 ——",
    code.trim(),
    "\n# —— ACM 标准输入输出 ——",
    ...helpers,
    "\n" + runner,
  ].join("\n");
}

// ————— JavaScript / TypeScript ACM 生成 —————

function jsTsAcm(code: string, sig: PracticeSignature, ts: boolean): string {
  const n = detectNeeds(sig);
  const defs: string[] = [];
  if (n.list) {
    defs.push(
      ts
        ? `class ListNode {\n  val: number;\n  next: ListNode | null;\n  constructor(val = 0, next: ListNode | null = null) {\n    this.val = val;\n    this.next = next;\n  }\n}`
        : `function ListNode(val, next) {\n  this.val = val === undefined ? 0 : val;\n  this.next = next === undefined ? null : next;\n}`,
    );
  }
  if (n.tree) {
    defs.push(
      ts
        ? `class TreeNode {\n  val: number;\n  left: TreeNode | null;\n  right: TreeNode | null;\n  constructor(val = 0, left: TreeNode | null = null, right: TreeNode | null = null) {\n    this.val = val;\n    this.left = left;\n    this.right = right;\n  }\n}`
        : `function TreeNode(val, left, right) {\n  this.val = val === undefined ? 0 : val;\n  this.left = left === undefined ? null : left;\n  this.right = right === undefined ? null : right;\n}`,
    );
  }
  if (n.random) {
    defs.push(
      ts
        ? `class _Node {\n  val: number;\n  next: _Node | null;\n  random: _Node | null;\n  constructor(val = 0, next: _Node | null = null, random: _Node | null = null) {\n    this.val = val;\n    this.next = next;\n    this.random = random;\n  }\n}`
        : `function _Node(val, next, random) {\n  this.val = val;\n  this.next = next === undefined ? null : next;\n  this.random = random === undefined ? null : random;\n}`,
    );
  }

  const lines: string[] = [
    `const __fs = require("fs");`,
    `const __SIG = ${JSON.stringify(sig)};`,
    `const __lines = __fs.readFileSync(0, "utf8").replace(/\\r/g, "").split("\\n");`,
    `let __at = 0;`,
    `function __next() { return __at < __lines.length ? __lines[__at++] : ""; }`,
    `function __item(t) { return t.endsWith("[]") ? t.slice(0, -2) : (/^List<(.+)>$/.exec(t)?.[1] ?? null); }`,
    `function __atom(s, t) {\n  if (t === "string" || t === "char") return s;\n  if (t === "bool") return s === "true" || s === "True" || s === "1";\n  if (s === "null" || (t === "NodeIndex" && s === "-1")) return null;\n  return Number(s);\n}`,
  ];

  if (n.list) {
    lines.push(
      `let __baseNodes = [];`,
      `function __buildList(vals, keep) {\n  const nodes = vals.map((v) => new ListNode(v));\n  for (let i = 0; i + 1 < nodes.length; i++) nodes[i].next = nodes[i + 1];\n  if (keep) __baseNodes = nodes;\n  return [nodes[0] || null, nodes];\n}`,
      `function __dumpList(head) {\n  const out = [];\n  for (let p = head; p && out.length < 100000; p = p.next) out.push(p.val);\n  return out;\n}`,
    );
  }
  if (n.tree) {
    lines.push(
      `const __treeMap = new Map();`,
      `function __buildTree(vals) {\n  __treeMap.clear();\n  if (!vals.length || vals[0] === null) return null;\n  const root = new TreeNode(vals[0]);\n  __treeMap.set(root.val, root);\n  const q = [root];\n  for (let i = 1, h = 0; h < q.length && i < vals.length; h++) {\n    const cur = q[h];\n    if (vals[i] !== undefined && vals[i] !== null) { cur.left = new TreeNode(vals[i]); __treeMap.set(cur.left.val, cur.left); q.push(cur.left); }\n    i++;\n    if (i < vals.length && vals[i] !== undefined && vals[i] !== null) { cur.right = new TreeNode(vals[i]); __treeMap.set(cur.right.val, cur.right); q.push(cur.right); }\n    i++;\n  }\n  return root;\n}`,
      `function __dumpTree(root) {\n  if (!root) return [];\n  const out = [], q = [root];\n  for (let h = 0; h < q.length && out.length < 100000; h++) {\n    const node = q[h];\n    if (!node) out.push(null);\n    else { out.push(node.val); q.push(node.left, node.right); }\n  }\n  while (out.length && out[out.length - 1] === null) out.pop();\n  return out;\n}`,
    );
  }
  if (n.random) {
    lines.push(
      `function __buildRandom(rows) {\n  const nodes = rows.map(([v]) => new _Node(v));\n  for (let i = 0; i < rows.length; i++) {\n    nodes[i].next = i + 1 < nodes.length ? nodes[i + 1] : null;\n    nodes[i].random = rows[i][1] === null ? null : nodes[rows[i][1]];\n  }\n  return nodes[0] || null;\n}`,
      `function __dumpRandom(head) {\n  const idx = new Map();\n  for (let p = head; p && idx.size < 100000; p = p.next) idx.set(p, idx.size);\n  const res = [];\n  for (let p = head; p && res.length < 100000; p = p.next) {\n    res.push(p.val + " " + (p.random == null ? -1 : idx.get(p.random)));\n  }\n  return [String(res.length), ...res];\n}`,
    );
  }

  lines.push(
    `function __read(t) {\n` +
      (n.list
        ? `  if (t === "ListNode") return __buildList(__read("int[]"), true)[0];\n` +
          `  if (t === "CycleList") { const vals = __read("int[]"), pos = __read("int"); const [head, nodes] = __buildList(vals, true); if (nodes.length && pos >= 0) nodes[nodes.length - 1].next = nodes[pos]; return head; }\n` +
          `  if (t === "JoinList") { const vals = __read("int[]"), k = __read("int"); const [head, nodes] = __buildList(vals, false); if (k >= 0 && __baseNodes.length) { if (nodes.length) nodes[nodes.length - 1].next = __baseNodes[k]; else return __baseNodes[k]; } return head; }\n`
        : "") +
      (n.tree
        ? `  if (t === "TreeNode") return __buildTree(__read("nullable-int[]"));\n` +
          `  if (t === "TreeRef") return __treeMap.get(__read("int"));\n`
        : "") +
      (n.random
        ? `  if (t === "RandomList") { const n = Number(__next()); const rows = []; for (let i = 0; i < n; i++) { const [v, r] = __next().trim().split(/\\s+/).map(Number); rows.push([v, r === -1 ? null : r]); } return __buildRandom(rows); }\n`
        : "") +
      `  const item = __item(t);\n  if (!item) return __atom(__next(), t);\n  const cnt = Number(__next());\n  if (["int", "long", "double", "bool", "char", "nullable-int"].includes(item)) {\n    const toks = [];\n    while (toks.length < cnt) toks.push(...__next().trim().split(/\\s+/).filter(Boolean));\n    return toks.map((s) => __atom(s, item));\n  }\n  return Array.from({ length: cnt }, () => __read(item));\n}`,
  );

  lines.push(
    `function __format(v, t) {\n` +
      (n.list
        ? `  if (t === "ListNode") return __format(__dumpList(v), "int[]");\n` +
          `  if (t === "NodeIndex") return [String(v ? __baseNodes.indexOf(v) : -1)];\n`
        : "") +
      (n.tree
        ? `  if (t === "TreeNode") return __format(__dumpTree(v), "nullable-int[]");\n` +
          `  if (t === "TreeVal") return [v == null ? "null" : String(v.val)];\n`
        : "") +
      (n.random ? `  if (t === "RandomList") return __dumpRandom(v);\n` : "") +
      `  const item = __item(t);\n  if (item) {\n    if (["int", "long", "double", "bool", "char", "nullable-int"].includes(item)) return [String(v.length), ...(v.length ? [v.map((x) => x == null ? "null" : String(x)).join(" ")] : [])];\n    return [String(v.length), ...v.flatMap((x) => __format(x, item))];\n  }\n  return [v == null ? (t === "NodeIndex" ? "-1" : "null") : String(v)];\n}`,
  );

  let runner = "";
  if (sig.cls) {
    runner = `const __q = Number(__next());
let __obj = null;
const __out = [];
for (let i = 0; i < __q; i++) {
  const [op, ...vals] = __next().trim().split(/\\s+/);
  const types = i === 0 ? __SIG.ctor : __SIG.methods[op][0];
  const args = vals.map((v, j) => __atom(v, types[j]));
  if (i === 0) { __obj = new ${sig.cls}(...args); __out.push("null"); }
  else { const res = __obj[op](...args); __out.push(res == null ? "null" : String(res)); }
}
console.log(__out.join("\\n"));`;
  } else {
    const ret = outType(sig);
    runner = `const __args = __SIG.params.map(__read);
const __res = ${sig.fn}(...__args);
const __ans = ${sig.ret === "void" ? `__args[${sig.out ?? 0}]` : "__res"};
console.log(__format(__ans, ${JSON.stringify(ret)}).join("\\n"));`;
  }

  return [
    ...(ts ? ["// @ts-nocheck"] : []),
    ...(defs.length ? ["// —— 数据结构定义 ——", ...defs, ""] : []),
    "// —— 核心解法 ——",
    code.trim(),
    "",
    "// —— ACM 标准输入输出 ——",
    ...lines,
    runner,
  ].join("\n");
}

// ————— Java ACM 生成 —————

const JAVA_BOX: Record<string, string> = { int: "Integer", long: "Long", double: "Double", bool: "Boolean", char: "Character", string: "String" };
function javaType(t: string): string {
  if (t.endsWith("[]")) return `${javaType(t.slice(0, -2))}[]`;
  const list = /^List<(.+)>$/.exec(t)?.[1];
  if (list) return `List<${JAVA_BOX[list] ?? javaType(list)}>`;
  return (
    ({
      int: "int", long: "long", double: "double", bool: "boolean", string: "String", char: "char",
      ListNode: "ListNode", CycleList: "ListNode", JoinList: "ListNode", NodeIndex: "ListNode",
      TreeNode: "TreeNode", TreeRef: "TreeNode", TreeVal: "TreeNode", RandomList: "Node",
    } as Record<string, string>)[t] ?? "Object"
  );
}

function javaReadExpr(t: string): string {
  switch (t) {
    case "int": return "AcmIO.nextInt()";
    case "long": return "AcmIO.nextLong()";
    case "double": return "AcmIO.nextDouble()";
    case "bool": return "AcmIO.nextBool()";
    case "string": return "AcmIO.nextLine()";
    case "char": return "AcmIO.nextChar()";
    case "int[]": return "AcmIO.readIntArray()";
    case "string[]": return "AcmIO.readStringArray()";
    case "List<string>": return "AcmIO.readStringList()";
    case "int[][]": return "AcmIO.readIntMatrix()";
    case "char[][]": return "AcmIO.readCharMatrix()";
    case "ListNode": return "AcmIO.buildList(AcmIO.readIntArray(), true)";
    case "ListNode[]": return "AcmIO.readListArray()";
    case "CycleList": return "AcmIO.readCycleList()";
    case "JoinList": return "AcmIO.readJoinList()";
    case "RandomList": return "AcmIO.readRandomList()";
    case "TreeNode": return "AcmIO.readTree()";
    case "TreeRef": return "AcmIO.treeMap.get(AcmIO.nextInt())";
    default: throw new Error(`Unsupported Java ACM input type: ${t}`);
  }
}

function javaWriteStmt(t: string, expr: string): string {
  switch (t) {
    case "int":
    case "long":
    case "double":
    case "bool":
    case "string":
    case "char":
      return `System.out.println(${expr});`;
    case "int[]": return `AcmIO.printIntArray(${expr});`;
    case "int[][]": return `AcmIO.printIntMatrix(${expr});`;
    case "List<int>": return `AcmIO.printIntList(${expr});`;
    case "List<string>": return `AcmIO.printStringList(${expr});`;
    case "List<List<int>>": return `AcmIO.printIntListList(${expr});`;
    case "List<List<string>>": return `AcmIO.printStringListList(${expr});`;
    case "ListNode": return `AcmIO.printListNode(${expr});`;
    case "NodeIndex": return `AcmIO.printNodeIndex(${expr});`;
    case "RandomList": return `AcmIO.printRandomList(${expr});`;
    case "TreeNode": return `AcmIO.printTree(${expr});`;
    case "TreeVal": return `System.out.println(${expr} == null ? "null" : String.valueOf(${expr}.val));`;
    default: return `System.out.println(${expr});`;
  }
}

function javaAcm(code: string, sig: PracticeSignature): string {
  const n = detectNeeds(sig);
  const imports: string[] = ["import java.io.*;", "import java.util.*;"];
  const body: string[] = [];
  for (const line of code.replace(/^public class /gm, "class ").split("\n")) {
    if (/^\s*import\s+[\w.*]+\s*;\s*$/.test(line)) {
      if (!imports.includes(line.trim())) imports.push(line.trim());
    } else {
      body.push(line);
    }
  }

  const defs: string[] = [];
  if (n.list) {
    defs.push(
      `class ListNode {\n    int val;\n    ListNode next;\n    ListNode() {}\n    ListNode(int val) { this.val = val; }\n    ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n}`,
    );
  }
  if (n.tree) {
    defs.push(
      `class TreeNode {\n    int val;\n    TreeNode left;\n    TreeNode right;\n    TreeNode() {}\n    TreeNode(int val) { this.val = val; }\n    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }\n}`,
    );
  }
  if (n.random) {
    defs.push(
      `class Node {\n    int val;\n    Node next;\n    Node random;\n    Node(int val) { this.val = val; }\n}`,
    );
  }

  let mainBody = "";
  if (sig.cls) {
    const branches = Object.entries(sig.methods ?? {}).map(([m, [ps, r]]) => {
      const args = ps.map((pt, i) => `${javaType(pt)} v${i} = AcmIO.parse${JAVA_BOX[pt] || "Int"}(parts[${i + 1}]);`).join(" ");
      const call = `obj.${m}(${ps.map((_, i) => `v${i}`).join(", ")})`;
      return `            case "${m}": { ${args} ${r === "void" ? `${call}; System.out.println("null");` : `System.out.println(${call});`} break; }`;
    });
    const ctorArgs = (sig.ctor ?? []).map((ct, i) => `AcmIO.parse${JAVA_BOX[ct] || "Int"}(parts[${i + 1}])`).join(", ");
    mainBody = `        int q = AcmIO.nextInt();
        ${sig.cls} obj = null;
        for (int i = 0; i < q; i++) {
            String[] parts = AcmIO.nextLine().trim().split("\\\\s+");
            if (i == 0) {
                obj = new ${sig.cls}(${ctorArgs});
                System.out.println("null");
                continue;
            }
            switch (parts[0]) {
${branches.join("\n")}
            }
        }`;
  } else {
    const params = sig.params ?? [];
    const reads = params.map((t, i) => `        ${javaType(t)} a${i} = ${javaReadExpr(t)};`);
    const call = `new Solution().${sig.fn}(${params.map((_, i) => `a${i}`).join(", ")})`;
    if (sig.ret === "void") {
      const outIdx = sig.out ?? 0;
      mainBody = `${reads.join("\n")}\n        ${call};\n        ${javaWriteStmt(params[outIdx], `a${outIdx}`)}`;
    } else {
      mainBody = `${reads.join("\n")}\n        ${javaType(sig.ret!)} ans = ${call};\n        ${javaWriteStmt(sig.ret!, "ans")}`;
    }
  }

  const helperClass = `class AcmIO {
    private static final List<String> lines = new ArrayList<>();
    private static int at = 0;
    static {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(System.in))) {
            String line;
            while ((line = br.readLine()) != null) lines.add(line);
        } catch (IOException ignored) {}
    }
    static String nextLine() { return at < lines.size() ? lines.get(at++) : ""; }
    static int nextInt() { return Integer.parseInt(nextLine().trim()); }
    static long nextLong() { return Long.parseLong(nextLine().trim()); }
    static double nextDouble() { return Double.parseDouble(nextLine().trim()); }
    static boolean nextBool() { String s = nextLine().trim(); return "true".equals(s) || "1".equals(s); }
    static char nextChar() { String s = nextLine(); return s.isEmpty() ? ' ' : s.charAt(0); }
    static int parseInteger(String s) { return Integer.parseInt(s); }
    static int parseInt(String s) { return Integer.parseInt(s); }
    static String parseString(String s) { return s; }
    static String[] readTokens(int n) {
        String[] res = new String[n];
        int k = 0;
        while (k < n) {
            String t = nextLine().trim();
            if (!t.isEmpty()) for (String p : t.split("\\\\s+")) if (k < n) res[k++] = p;
        }
        return res;
    }
    static int[] readIntArray() {
        int n = nextInt();
        int[] a = new int[n];
        String[] ts = readTokens(n);
        for (int i = 0; i < n; i++) a[i] = Integer.parseInt(ts[i]);
        return a;
    }
    static String[] readStringArray() {
        int n = nextInt();
        String[] a = new String[n];
        for (int i = 0; i < n; i++) a[i] = nextLine();
        return a;
    }
    static List<String> readStringList() { return Arrays.asList(readStringArray()); }
    static int[][] readIntMatrix() {
        int r = nextInt();
        int[][] m = new int[r][];
        for (int i = 0; i < r; i++) m[i] = readIntArray();
        return m;
    }
    static char[][] readCharMatrix() {
        int r = nextInt();
        char[][] m = new char[r][];
        for (int i = 0; i < r; i++) {
            int c = nextInt();
            m[i] = new char[c];
            String[] ts = readTokens(c);
            for (int j = 0; j < c; j++) m[i][j] = ts[j].charAt(0);
        }
        return m;
    }
    static void printIntArray(int[] a) {
        System.out.println(a.length);
        if (a.length > 0) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(' '); sb.append(a[i]); }
            System.out.println(sb);
        }
    }
    static void printIntList(List<Integer> a) {
        int[] arr = new int[a.size()];
        for (int i = 0; i < a.size(); i++) arr[i] = a.get(i);
        printIntArray(arr);
    }
    static void printIntMatrix(int[][] m) { System.out.println(m.length); for (int[] row : m) printIntArray(row); }
    static void printIntListList(List<List<Integer>> m) { System.out.println(m.size()); for (List<Integer> row : m) printIntList(row); }
    static void printStringList(List<String> a) { System.out.println(a.size()); for (String s : a) System.out.println(s); }
    static void printStringListList(List<List<String>> m) { System.out.println(m.size()); for (List<String> row : m) printStringList(row); }` +
    (n.list
      ? `
    static final List<ListNode> baseNodes = new ArrayList<>();
    static ListNode buildList(int[] vals, boolean keep) {
        List<ListNode> nodes = new ArrayList<>(vals.length);
        for (int v : vals) nodes.add(new ListNode(v));
        for (int i = 0; i + 1 < nodes.size(); i++) nodes.get(i).next = nodes.get(i + 1);
        if (keep) { baseNodes.clear(); baseNodes.addAll(nodes); }
        return nodes.isEmpty() ? null : nodes.get(0);
    }
    static ListNode[] readListArray() {
        int r = nextInt();
        ListNode[] a = new ListNode[r];
        for (int i = 0; i < r; i++) a[i] = buildList(readIntArray(), false);
        return a;
    }
    static ListNode readCycleList() {
        int[] vals = readIntArray();
        int pos = nextInt();
        ListNode head = buildList(vals, true);
        if (!baseNodes.isEmpty() && pos >= 0) baseNodes.get(baseNodes.size() - 1).next = baseNodes.get(pos);
        return head;
    }
    static ListNode readJoinList() {
        int[] vals = readIntArray();
        int k = nextInt();
        List<ListNode> nodes = new ArrayList<>(vals.length);
        for (int v : vals) nodes.add(new ListNode(v));
        for (int i = 0; i + 1 < nodes.size(); i++) nodes.get(i).next = nodes.get(i + 1);
        if (k >= 0 && !baseNodes.isEmpty()) {
            if (!nodes.isEmpty()) nodes.get(nodes.size() - 1).next = baseNodes.get(k);
            else return baseNodes.get(k);
        }
        return nodes.isEmpty() ? null : nodes.get(0);
    }
    static void printListNode(ListNode head) {
        List<Integer> out = new ArrayList<>();
        while (head != null && out.size() < 100000) { out.add(head.val); head = head.next; }
        printIntList(out);
    }
    static void printNodeIndex(ListNode node) {
        int idx = -1;
        if (node != null) for (int i = 0; i < baseNodes.size(); i++) if (baseNodes.get(i) == node) { idx = i; break; }
        System.out.println(idx);
    }`
      : "") +
    (n.tree
      ? `
    static final Map<Integer, TreeNode> treeMap = new HashMap<>();
    static TreeNode readTree() {
        treeMap.clear();
        int cnt = nextInt();
        if (cnt == 0) return null;
        String[] ts = readTokens(cnt);
        if ("null".equals(ts[0])) return null;
        TreeNode root = new TreeNode(Integer.parseInt(ts[0]));
        treeMap.put(root.val, root);
        Queue<TreeNode> q = new LinkedList<>();
        q.offer(root);
        int i = 1;
        while (!q.isEmpty() && i < ts.length) {
            TreeNode cur = q.poll();
            if (!"null".equals(ts[i])) { cur.left = new TreeNode(Integer.parseInt(ts[i])); treeMap.put(cur.left.val, cur.left); q.offer(cur.left); }
            i++;
            if (i < ts.length && !"null".equals(ts[i])) { cur.right = new TreeNode(Integer.parseInt(ts[i])); treeMap.put(cur.right.val, cur.right); q.offer(cur.right); }
            i++;
        }
        return root;
    }
    static void printTree(TreeNode root) {
        if (root == null) { System.out.println(0); return; }
        List<String> out = new ArrayList<>();
        Queue<TreeNode> q = new LinkedList<>();
        q.offer(root);
        while (!q.isEmpty() && out.size() < 100000) {
            TreeNode cur = q.poll();
            if (cur == null) out.add("null");
            else { out.add(String.valueOf(cur.val)); q.offer(cur.left); q.offer(cur.right); }
        }
        while (!out.isEmpty() && "null".equals(out.get(out.size() - 1))) out.remove(out.size() - 1);
        System.out.println(out.size());
        if (!out.isEmpty()) System.out.println(String.join(" ", out));
    }`
      : "") +
    (n.random
      ? `
    static Node readRandomList() {
        int n = nextInt();
        if (n == 0) return null;
        Node[] nodes = new Node[n];
        int[] rand = new int[n];
        for (int i = 0; i < n; i++) {
            String[] ps = readTokens(2);
            nodes[i] = new Node(Integer.parseInt(ps[0]));
            rand[i] = Integer.parseInt(ps[1]);
        }
        for (int i = 0; i < n; i++) {
            nodes[i].next = i + 1 < n ? nodes[i + 1] : null;
            nodes[i].random = rand[i] < 0 ? null : nodes[rand[i]];
        }
        return nodes[0];
    }
    static void printRandomList(Node head) {
        Map<Node, Integer> idx = new IdentityHashMap<>();
        for (Node p = head; p != null; p = p.next) idx.put(p, idx.size());
        System.out.println(idx.size());
        for (Node p = head; p != null; p = p.next) {
            System.out.println(p.val + " " + (p.random == null ? -1 : idx.get(p.random)));
        }
    }`
      : "") +
    `\n}`;

  return [
    ...imports,
    ...(defs.length ? ["\n// —— 数据结构定义 ——", ...defs] : []),
    "\n// —— 核心解法 ——",
    body.join("\n").trim(),
    "\n// —— ACM 标准输入输出 ——",
    `public class Main {\n    public static void main(String[] args) {\n${mainBody}\n    }\n}`,
    helperClass,
  ].join("\n");
}

// ————— C++ ACM 生成 —————

function cppType(t: string): string {
  const item = itemType(t);
  if (item) return `vector<${cppType(item)}>`;
  return (
    ({
      int: "int", long: "long long", double: "double", bool: "bool", string: "string", char: "char",
      ListNode: "ListNode*", CycleList: "ListNode*", JoinList: "ListNode*", NodeIndex: "ListNode*",
      TreeNode: "TreeNode*", TreeRef: "TreeNode*", TreeVal: "TreeNode*", RandomList: "Node*",
    } as Record<string, string>)[t] ?? "auto"
  );
}

function cppReadExpr(t: string): string {
  switch (t) {
    case "int": return "acm::nextInt()";
    case "long": return "acm::nextLong()";
    case "double": return "acm::nextDouble()";
    case "bool": return "acm::nextBool()";
    case "string": return "acm::nextLine()";
    case "char": return "acm::nextChar()";
    case "int[]": return "acm::readInts()";
    case "string[]":
    case "List<string>": return "acm::readStrings()";
    case "int[][]": return "acm::readIntMatrix()";
    case "char[][]": return "acm::readCharMatrix()";
    case "ListNode": return "acm::buildList(acm::readInts(), true)";
    case "ListNode[]": return "acm::readListArray()";
    case "CycleList": return "acm::readCycleList()";
    case "JoinList": return "acm::readJoinList()";
    case "RandomList": return "acm::readRandomList()";
    case "TreeNode": return "acm::readTree()";
    case "TreeRef": return "acm::treeMap[acm::nextInt()]";
    default: throw new Error(`Unsupported C++ ACM input type: ${t}`);
  }
}

function cppWriteStmt(t: string, expr: string): string {
  switch (t) {
    case "int":
    case "long":
    case "double":
    case "string":
    case "char":
      return `cout << ${expr} << '\\n';`;
    case "bool": return `cout << (${expr} ? "true" : "false") << '\\n';`;
    case "int[]":
    case "List<int>": return `acm::printInts(${expr});`;
    case "int[][]":
    case "List<List<int>>": return `acm::printIntMatrix(${expr});`;
    case "string[]":
    case "List<string>": return `acm::printStrings(${expr});`;
    case "List<List<string>>": return `acm::printStringMatrix(${expr});`;
    case "ListNode": return `acm::printList(${expr});`;
    case "NodeIndex": return `acm::printNodeIndex(${expr});`;
    case "RandomList": return `acm::printRandomList(${expr});`;
    case "TreeNode": return `acm::printTree(${expr});`;
    case "TreeVal": return `cout << (${expr} ? to_string(${expr}->val) : "null") << '\\n';`;
    default: return `cout << ${expr} << '\\n';`;
  }
}

function cppAcm(code: string, sig: PracticeSignature): string {
  const n = detectNeeds(sig);
  const defs: string[] = [];
  if (n.list) {
    defs.push(
      `struct ListNode {\n    int val;\n    ListNode *next;\n    ListNode() : val(0), next(nullptr) {}\n    ListNode(int x) : val(x), next(nullptr) {}\n    ListNode(int x, ListNode *next) : val(x), next(next) {}\n};`,
    );
  }
  if (n.tree) {
    defs.push(
      `struct TreeNode {\n    int val;\n    TreeNode *left;\n    TreeNode *right;\n    TreeNode() : val(0), left(nullptr), right(nullptr) {}\n    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}\n    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}\n};`,
    );
  }
  if (n.random) {
    defs.push(
      `class Node {\npublic:\n    int val;\n    Node* next;\n    Node* random;\n    Node(int _val) : val(_val), next(nullptr), random(nullptr) {}\n};`,
    );
  }

  let mainBody = "";
  if (sig.cls) {
    const parseArg = (t: string, idx: number) =>
      t === "string" ? `parts[${idx}]` : `stoi(parts[${idx}])`;
    const ctorArgs = (sig.ctor ?? []).map((t, i) => parseArg(t, i + 1)).join(", ");
    const branches = Object.entries(sig.methods ?? {}).map(([m, [ps, r]]) => {
      const args = ps.map((t, i) => parseArg(t, i + 1)).join(", ");
      const call = `obj->${m}(${args})`;
      if (r === "void") return `        else if (parts[0] == "${m}") { ${call}; cout << "null\\n"; }`;
      if (r === "bool") return `        else if (parts[0] == "${m}") cout << (${call} ? "true" : "false") << '\\n';`;
      return `        else if (parts[0] == "${m}") cout << ${call} << '\\n';`;
    });
    mainBody = `    int q = acm::nextInt();
    ${sig.cls}* obj = nullptr;
    for (int i = 0; i < q; i++) {
        auto parts = acm::splitLine();
        if (i == 0) {
            obj = new ${sig.cls}(${ctorArgs});
            cout << "null\\n";
        }
${branches.join("\n")}
    }`;
  } else {
    const params = sig.params ?? [];
    const reads = params.map((t, i) => `    ${cppType(t)} a${i} = ${cppReadExpr(t)};`);
    const call = `Solution().${sig.fn}(${params.map((_, i) => `a${i}`).join(", ")})`;
    if (sig.ret === "void") {
      const outIdx = sig.out ?? 0;
      mainBody = `${reads.join("\n")}\n    ${call};\n    ${cppWriteStmt(params[outIdx], `a${outIdx}`)}`;
    } else {
      mainBody = `${reads.join("\n")}\n    auto ans = ${call};\n    ${cppWriteStmt(sig.ret!, "ans")}`;
    }
  }

  return [
    `#include <bits/stdc++.h>\nusing namespace std;`,
    ...(defs.length ? ["\n// —— 数据结构定义 ——", ...defs] : []),
    "\n// —— ACM 标准输入输出工具 ——",
    `namespace acm {
    vector<string> lines;
    size_t at = 0;
    void init() {
        string s;
        while (getline(cin, s)) {
            if (!s.empty() && s.back() == '\\r') s.pop_back();
            lines.push_back(s);
        }
    }
    string nextLine() { return at < lines.size() ? lines[at++] : ""; }
    int nextInt() { return stoi(nextLine()); }
    long long nextLong() { return stoll(nextLine()); }
    double nextDouble() { return stod(nextLine()); }
    bool nextBool() { string s = nextLine(); return s.find("true") != string::npos || s.find('1') != string::npos; }
    char nextChar() { string s = nextLine(); return s.empty() ? ' ' : s[0]; }
    vector<string> splitLine() {
        vector<string> res; string w; istringstream iss(nextLine());
        while (iss >> w) res.push_back(w);
        return res;
    }
    vector<string> readTokens(int n) {
        vector<string> res;
        while ((int)res.size() < n) {
            for (auto& w : splitLine()) if ((int)res.size() < n) res.push_back(w);
        }
        return res;
    }
    vector<int> readInts() {
        int n = nextInt(); vector<int> a(n);
        auto ts = readTokens(n);
        for (int i = 0; i < n; i++) a[i] = stoi(ts[i]);
        return a;
    }
    vector<string> readStrings() {
        int n = nextInt(); vector<string> a(n);
        for (int i = 0; i < n; i++) a[i] = nextLine();
        return a;
    }
    vector<vector<int>> readIntMatrix() {
        int r = nextInt(); vector<vector<int>> m(r);
        for (int i = 0; i < r; i++) m[i] = readInts();
        return m;
    }
    vector<vector<char>> readCharMatrix() {
        int r = nextInt(); vector<vector<char>> m(r);
        for (int i = 0; i < r; i++) {
            int c = nextInt(); m[i].resize(c);
            auto ts = readTokens(c);
            for (int j = 0; j < c; j++) m[i][j] = ts[j][0];
        }
        return m;
    }
    void printInts(const vector<int>& a) {
        cout << a.size() << '\\n';
        if (!a.empty()) {
            for (size_t i = 0; i < a.size(); i++) cout << (i ? " " : "") << a[i];
            cout << '\\n';
        }
    }
    void printIntMatrix(const vector<vector<int>>& m) { cout << m.size() << '\\n'; for (auto& r : m) printInts(r); }
    void printStrings(const vector<string>& a) { cout << a.size() << '\\n'; for (auto& s : a) cout << s << '\\n'; }
    void printStringMatrix(const vector<vector<string>>& m) { cout << m.size() << '\\n'; for (auto& r : m) printStrings(r); }` +
      (n.list
        ? `
    vector<ListNode*> baseNodes;
    ListNode* buildList(const vector<int>& vals, bool keep) {
        vector<ListNode*> ns; ns.reserve(vals.size());
        for (int v : vals) ns.push_back(new ListNode(v));
        for (size_t i = 0; i + 1 < ns.size(); i++) ns[i]->next = ns[i + 1];
        if (keep) baseNodes = ns;
        return ns.empty() ? nullptr : ns[0];
    }
    vector<ListNode*> readListArray() {
        int r = nextInt(); vector<ListNode*> a(r);
        for (int i = 0; i < r; i++) a[i] = buildList(readInts(), false);
        return a;
    }
    ListNode* readCycleList() {
        auto vals = readInts(); int pos = nextInt();
        ListNode* h = buildList(vals, true);
        if (!baseNodes.empty() && pos >= 0) baseNodes.back()->next = baseNodes[pos];
        return h;
    }
    ListNode* readJoinList() {
        auto vals = readInts(); int k = nextInt();
        vector<ListNode*> ns;
        for (int v : vals) ns.push_back(new ListNode(v));
        for (size_t i = 0; i + 1 < ns.size(); i++) ns[i]->next = ns[i + 1];
        if (k >= 0 && !baseNodes.empty()) {
            if (!ns.empty()) ns.back()->next = baseNodes[k];
            else return baseNodes[k];
        }
        return ns.empty() ? nullptr : ns[0];
    }
    void printList(ListNode* h) {
        vector<int> out;
        for (; h && out.size() < 100000; h = h->next) out.push_back(h->val);
        printInts(out);
    }
    void printNodeIndex(ListNode* node) {
        int idx = -1;
        if (node) for (int i = 0; i < (int)baseNodes.size(); i++) if (baseNodes[i] == node) { idx = i; break; }
        cout << idx << '\\n';
    }`
        : "") +
      (n.tree
        ? `
    unordered_map<int, TreeNode*> treeMap;
    TreeNode* readTree() {
        treeMap.clear();
        int cnt = nextInt(); if (cnt == 0) return nullptr;
        auto ts = readTokens(cnt); if (ts[0] == "null") return nullptr;
        TreeNode* root = new TreeNode(stoi(ts[0])); treeMap[root->val] = root;
        queue<TreeNode*> q; q.push(root);
        for (size_t i = 1; !q.empty() && i < ts.size();) {
            TreeNode* cur = q.front(); q.pop();
            if (ts[i] != "null") { cur->left = new TreeNode(stoi(ts[i])); treeMap[cur->left->val] = cur->left; q.push(cur->left); }
            i++;
            if (i < ts.size() && ts[i] != "null") { cur->right = new TreeNode(stoi(ts[i])); treeMap[cur->right->val] = cur->right; q.push(cur->right); }
            i++;
        }
        return root;
    }
    void printTree(TreeNode* root) {
        if (!root) { cout << "0\\n"; return; }
        vector<string> out; queue<TreeNode*> q; q.push(root);
        while (!q.empty() && out.size() < 100000) {
            TreeNode* cur = q.front(); q.pop();
            if (!cur) out.push_back("null");
            else { out.push_back(to_string(cur->val)); q.push(cur->left); q.push(cur->right); }
        }
        while (!out.empty() && out.back() == "null") out.pop_back();
        cout << out.size() << '\\n';
        if (!out.empty()) {
            for (size_t i = 0; i < out.size(); i++) cout << (i ? " " : "") << out[i];
            cout << '\\n';
        }
    }`
        : "") +
      (n.random
        ? `
    Node* readRandomList() {
        int n = nextInt(); if (n == 0) return nullptr;
        vector<Node*> ns(n); vector<int> r(n);
        for (int i = 0; i < n; i++) {
            auto ps = readTokens(2);
            ns[i] = new Node(stoi(ps[0])); r[i] = stoi(ps[1]);
        }
        for (int i = 0; i < n; i++) {
            ns[i]->next = i + 1 < n ? ns[i + 1] : nullptr;
            ns[i]->random = r[i] < 0 ? nullptr : ns[r[i]];
        }
        return ns[0];
    }
    void printRandomList(Node* head) {
        unordered_map<Node*, int> idx;
        for (Node* p = head; p; p = p->next) idx[p] = (int)idx.size();
        cout << idx.size() << '\\n';
        for (Node* p = head; p; p = p->next) {
            cout << p->val << ' ' << (p->random ? idx[p->random] : -1) << '\\n';
        }
    }`
        : "") +
      `\n}`,
    "\n// —— 核心解法 ——",
    code.trim(),
    "\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    acm::init();\n" + mainBody + "\n    return 0;\n}",
  ].join("\n");
}

// ————— Go ACM 生成 —————

const GO_PKGS: [string, string][] = [
  ["sort", "sort"], ["strings", "strings"], ["strconv", "strconv"], ["math", "math"], ["heap", "container/heap"],
  ["list", "container/list"], ["bits", "math/bits"], ["rand", "math/rand"], ["slices", "slices"], ["maps", "maps"],
  ["bytes", "bytes"], ["unicode", "unicode"], ["fmt", "fmt"],
];

function goType(t: string): string {
  const item = itemType(t);
  if (item) return `[]${goType(item)}`;
  return (
    ({
      int: "int", long: "int64", double: "float64", bool: "bool", string: "string", char: "byte",
      ListNode: "*ListNode", CycleList: "*ListNode", JoinList: "*ListNode", NodeIndex: "*ListNode",
      TreeNode: "*TreeNode", TreeRef: "*TreeNode", TreeVal: "*TreeNode", RandomList: "*Node",
    } as Record<string, string>)[t] ?? "any"
  );
}

function goReadExpr(t: string): string {
  switch (t) {
    case "int": return "acmNextInt()";
    case "long": return "acmNextInt64()";
    case "double": return "acmNextFloat()";
    case "bool": return "acmNextBool()";
    case "string": return "acmNextLine()";
    case "char": return "acmNextChar()";
    case "int[]": return "acmReadInts()";
    case "string[]":
    case "List<string>": return "acmReadStrings()";
    case "int[][]": return "acmReadIntMatrix()";
    case "char[][]": return "acmReadCharMatrix()";
    case "ListNode": return "acmBuildList(acmReadInts(), true)";
    case "ListNode[]": return "acmReadListArray()";
    case "CycleList": return "acmReadCycleList()";
    case "JoinList": return "acmReadJoinList()";
    case "RandomList": return "acmReadRandomList()";
    case "TreeNode": return "acmReadTree()";
    case "TreeRef": return "acmTreeMap[acmNextInt()]";
    default: throw new Error(`Unsupported Go ACM input type: ${t}`);
  }
}

function goWriteStmt(t: string, expr: string): string {
  switch (t) {
    case "int":
    case "long":
    case "double":
    case "bool":
    case "string":
      return `fmt.Println(${expr})`;
    case "char": return `fmt.Printf("%c\\n", ${expr})`;
    case "int[]":
    case "List<int>": return `acmPrintInts(${expr})`;
    case "int[][]":
    case "List<List<int>>": return `acmPrintIntMatrix(${expr})`;
    case "string[]":
    case "List<string>": return `acmPrintStrings(${expr})`;
    case "List<List<string>>": return `acmPrintStringMatrix(${expr})`;
    case "ListNode": return `acmPrintList(${expr})`;
    case "NodeIndex": return `acmPrintNodeIndex(${expr})`;
    case "RandomList": return `acmPrintRandomList(${expr})`;
    case "TreeNode": return `acmPrintTree(${expr})`;
    case "TreeVal": return `if ${expr} == nil { fmt.Println("null") } else { fmt.Println(${expr}.Val) }`;
    default: return `fmt.Println(${expr})`;
  }
}

function goAcm(code: string, sig: PracticeSignature): string {
  const n = detectNeeds(sig);
  const cleaned = code.replace(/\/\/.*$/gm, "").replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const needed = new Set<string>(["bufio", "fmt", "os", "strconv", "strings"]);
  for (const [name, pkg] of GO_PKGS) {
    if (new RegExp(`\\b${name}\\.[A-Za-z]`).test(cleaned)) needed.add(pkg);
  }
  const imports = [...needed].sort().map((p) => `\t"${p}"`);

  const defs: string[] = [];
  if (n.list) defs.push(`type ListNode struct {\n\tVal  int\n\tNext *ListNode\n}`);
  if (n.tree) defs.push(`type TreeNode struct {\n\tVal   int\n\tLeft  *TreeNode\n\tRight *TreeNode\n}`);
  if (n.random) defs.push(`type Node struct {\n\tVal    int\n\tNext   *Node\n\tRandom *Node\n}`);

  let mainBody = "";
  if (sig.cls) {
    const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
    const parse = (t: string, idx: number) =>
      t === "string" ? `parts[${idx}]` : `acmAtoi(parts[${idx}])`;
    const ctorArgs = (sig.ctor ?? []).map((t, i) => parse(t, i + 1)).join(", ");
    const branches = Object.entries(sig.methods ?? {}).map(([m, [ps, r]]) => {
      const call = `obj.${cap(m)}(${ps.map((t, i) => parse(t, i + 1)).join(", ")})`;
      return `\t\tcase "${m}":\n\t\t\t` + (r === "void" ? `${call}\n\t\t\tfmt.Println("null")` : `fmt.Println(${call})`);
    });
    mainBody = `\tq := acmNextInt()
\tvar obj ${sig.cls}
\tfor i := 0; i < q; i++ {
\t\tparts := strings.Fields(acmNextLine())
\t\tif i == 0 {
\t\t\tobj = Constructor(${ctorArgs})
\t\t\tfmt.Println("null")
\t\t\tcontinue
\t\t}
\t\tswitch parts[0] {
${branches.join("\n")}
\t\t}
\t}`;
  } else {
    const params = sig.params ?? [];
    const reads = params.map((t, i) => `\ta${i} := ${goReadExpr(t)}`);
    const call = `${sig.fn}(${params.map((_, i) => `a${i}`).join(", ")})`;
    if (sig.ret === "void") {
      const outIdx = sig.out ?? 0;
      mainBody = `${reads.join("\n")}\n\t${call}\n\t${goWriteStmt(params[outIdx], `a${outIdx}`)}`;
    } else {
      mainBody = `${reads.join("\n")}\n\tans := ${call}\n\t${goWriteStmt(sig.ret!, "ans")}`;
    }
  }

  return [
    `package main\n\nimport (\n${imports.join("\n")}\n)`,
    ...(defs.length ? ["\n// —— 数据结构定义 ——", ...defs] : []),
    "\n// —— 核心解法 ——",
    code.trim(),
    "\n// —— ACM 标准输入输出 ——",
    `var acmLines []string
var acmAt int

func acmInit() {
	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024*1024), 16*1024*1024)
	for sc.Scan() {
		acmLines = append(acmLines, strings.TrimRight(sc.Text(), "\\r"))
	}
}
func acmNextLine() string { if acmAt < len(acmLines) { s := acmLines[acmAt]; acmAt++; return s }; return "" }
func acmAtoi(s string) int { v, _ := strconv.Atoi(strings.TrimSpace(s)); return v }
func acmNextInt() int { return acmAtoi(acmNextLine()) }
func acmNextInt64() int64 { v, _ := strconv.ParseInt(strings.TrimSpace(acmNextLine()), 10, 64); return v }
func acmNextFloat() float64 { v, _ := strconv.ParseFloat(strings.TrimSpace(acmNextLine()), 64); return v }
func acmNextBool() bool { s := strings.TrimSpace(acmNextLine()); return s == "true" || s == "1" }
func acmNextChar() byte { s := acmNextLine(); if len(s) == 0 { return ' ' }; return s[0] }
func acmReadTokens(n int) []string {
	res := make([]string, 0, n)
	for len(res) < n {
		res = append(res, strings.Fields(acmNextLine())...)
	}
	return res[:n]
}
func acmReadInts() []int {
	n := acmNextInt()
	a := make([]int, n)
	for i, s := range acmReadTokens(n) { a[i] = acmAtoi(s) }
	return a
}
func acmReadStrings() []string {
	n := acmNextInt()
	a := make([]string, n)
	for i := 0; i < n; i++ { a[i] = acmNextLine() }
	return a
}
func acmReadIntMatrix() [][]int {
	r := acmNextInt()
	m := make([][]int, r)
	for i := 0; i < r; i++ { m[i] = acmReadInts() }
	return m
}
func acmReadCharMatrix() [][]byte {
	r := acmNextInt()
	m := make([][]byte, r)
	for i := 0; i < r; i++ {
		c := acmNextInt()
		m[i] = make([]byte, c)
		for j, s := range acmReadTokens(c) { m[i][j] = s[0] }
	}
	return m
}
func acmPrintInts(a []int) {
	fmt.Println(len(a))
	if len(a) > 0 {
		s := make([]string, len(a))
		for i, v := range a { s[i] = strconv.Itoa(v) }
		fmt.Println(strings.Join(s, " "))
	}
}
func acmPrintIntMatrix(m [][]int) { fmt.Println(len(m)); for _, r := range m { acmPrintInts(r) } }
func acmPrintStrings(a []string) { fmt.Println(len(a)); for _, s := range a { fmt.Println(s) } }
func acmPrintStringMatrix(m [][]string) { fmt.Println(len(m)); for _, r := range m { acmPrintStrings(r) } }` +
      (n.list
        ? `
var acmBaseNodes []*ListNode
func acmBuildList(vals []int, keep bool) *ListNode {
	ns := make([]*ListNode, len(vals))
	for i, v := range vals { ns[i] = &ListNode{Val: v} }
	for i := 0; i+1 < len(ns); i++ { ns[i].Next = ns[i+1] }
	if keep { acmBaseNodes = ns }
	if len(ns) == 0 { return nil }
	return ns[0]
}
func acmReadListArray() []*ListNode {
	r := acmNextInt()
	a := make([]*ListNode, r)
	for i := 0; i < r; i++ { a[i] = acmBuildList(acmReadInts(), false) }
	return a
}
func acmReadCycleList() *ListNode {
	vals := acmReadInts(); pos := acmNextInt()
	h := acmBuildList(vals, true)
	if len(acmBaseNodes) > 0 && pos >= 0 { acmBaseNodes[len(acmBaseNodes)-1].Next = acmBaseNodes[pos] }
	return h
}
func acmReadJoinList() *ListNode {
	vals := acmReadInts(); k := acmNextInt()
	ns := make([]*ListNode, len(vals))
	for i, v := range vals { ns[i] = &ListNode{Val: v} }
	for i := 0; i+1 < len(ns); i++ { ns[i].Next = ns[i+1] }
	if k >= 0 && len(acmBaseNodes) > 0 {
		if len(ns) > 0 { ns[len(ns)-1].Next = acmBaseNodes[k] } else { return acmBaseNodes[k] }
	}
	if len(ns) == 0 { return nil }
	return ns[0]
}
func acmPrintList(h *ListNode) {
	var out []int
	for p := h; p != nil && len(out) < 100000; p = p.Next { out = append(out, p.Val) }
	acmPrintInts(out)
}
func acmPrintNodeIndex(node *ListNode) {
	idx := -1
	if node != nil { for i, p := range acmBaseNodes { if p == node { idx = i; break } } }
	fmt.Println(idx)
}`
        : "") +
      (n.tree
        ? `
var acmTreeMap = map[int]*TreeNode{}
func acmReadTree() *TreeNode {
	acmTreeMap = map[int]*TreeNode{}
	cnt := acmNextInt()
	if cnt == 0 { return nil }
	ts := acmReadTokens(cnt)
	if ts[0] == "null" { return nil }
	root := &TreeNode{Val: acmAtoi(ts[0])}
	acmTreeMap[root.Val] = root
	q := []*TreeNode{root}
	for i, h := 1, 0; h < len(q) && i < len(ts); h++ {
		cur := q[h]
		if ts[i] != "null" { cur.Left = &TreeNode{Val: acmAtoi(ts[i])}; acmTreeMap[cur.Left.Val] = cur.Left; q = append(q, cur.Left) }
		i++
		if i < len(ts) && ts[i] != "null" { cur.Right = &TreeNode{Val: acmAtoi(ts[i])}; acmTreeMap[cur.Right.Val] = cur.Right; q = append(q, cur.Right) }
		i++
	}
	return root
}
func acmPrintTree(root *TreeNode) {
	if root == nil { fmt.Println(0); return }
	var out []string
	q := []*TreeNode{root}
	for h := 0; h < len(q) && len(out) < 100000; h++ {
		cur := q[h]
		if cur == nil { out = append(out, "null") } else { out = append(out, strconv.Itoa(cur.Val)); q = append(q, cur.Left, cur.Right) }
	}
	for len(out) > 0 && out[len(out)-1] == "null" { out = out[:len(out)-1] }
	fmt.Println(len(out))
	if len(out) > 0 { fmt.Println(strings.Join(out, " ")) }
}`
        : "") +
      (n.random
        ? `
func acmReadRandomList() *Node {
	n := acmNextInt()
	if n == 0 { return nil }
	ns := make([]*Node, n); r := make([]int, n)
	for i := 0; i < n; i++ {
		ps := acmReadTokens(2)
		ns[i] = &Node{Val: acmAtoi(ps[0])}; r[i] = acmAtoi(ps[1])
	}
	for i := 0; i < n; i++ {
		if i+1 < n { ns[i].Next = ns[i+1] }
		if r[i] >= 0 { ns[i].Random = ns[r[i]] }
	}
	return ns[0]
}
func acmPrintRandomList(head *Node) {
	idx := map[*Node]int{}
	for p := head; p != nil; p = p.Next { idx[p] = len(idx) }
	fmt.Println(len(idx))
	for p := head; p != nil; p = p.Next {
		r := -1
		if p.Random != nil { r = idx[p.Random] }
		fmt.Printf("%d %d\\n", p.Val, r)
	}
}`
        : ""),
    `\nfunc main() {\n\tacmInit()\n${mainBody}\n}`,
  ].join("\n");
}

/**
 * 将六种官方语言（Python / JS / TS / Java / C++ / Go）的 LeetCode 核心代码解法
 * 包装成可直接在本站 ACM 模式下独立运行通过的完整标准输入输出题解。
 */
export function buildAcmSolution(
  code: string,
  lang: string,
  sig: PracticeSignature,
  parameterNames: string[],
): AcmSolutionResult | null {
  if (!code.trim()) return null;
  const tips = buildTips(sig, parameterNames);
  if (lang === "python") return { code: pythonAcm(code, sig), tips };
  if (lang === "javascript") return { code: jsTsAcm(code, sig, false), tips };
  if (lang === "typescript") return { code: jsTsAcm(code, sig, true), tips };
  if (lang === "java") return { code: javaAcm(code, sig), tips };
  if (lang === "cpp") return { code: cppAcm(code, sig), tips };
  if (lang === "go") return { code: goAcm(code, sig), tips };
  return null;
}
