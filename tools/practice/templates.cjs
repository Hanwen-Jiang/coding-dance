const itemType = (t) => t.endsWith("[]") ? t.slice(0, -2) : /^List<(.+)>$/.exec(t)?.[1];
const tsType = (t) => {
  const item = itemType(t);
  if (item) { const inner = tsType(item); return `${inner.includes("|") ? `(${inner})` : inner}[]`; }
  return ({ int: "number", long: "number", double: "number", bool: "boolean", string: "string", char: "string", void: "void", ListNode: "ListNode | null", CycleList: "ListNode | null", JoinList: "ListNode | null", NodeIndex: "ListNode | null", TreeNode: "TreeNode | null", TreeRef: "TreeNode", TreeVal: "TreeNode | null", RandomList: "_Node | null" })[t] || "unknown";
};
const pyType = (t) => {
  const item = itemType(t);
  if (item) return `List[${pyType(item)}]`;
  return ({ int: "int", long: "int", double: "float", bool: "bool", string: "str", char: "str", void: "None", ListNode: "Optional[ListNode]", CycleList: "Optional[ListNode]", JoinList: "Optional[ListNode]", NodeIndex: "Optional[ListNode]", TreeNode: "Optional[TreeNode]", TreeRef: "TreeNode", TreeVal: "Optional[TreeNode]", RandomList: "Optional[Node]" })[t] || "Any";
};
const outType = (s) => s.ret === "void" ? s.params[s.out || 0] : s.ret;
const jsDocType = (t) => {
  const item = itemType(t);
  if (item) return `${jsDocType(item)}[]`;
  return ({ int: "number", long: "number", double: "number", bool: "boolean", string: "string", char: "character", void: "void", ListNode: "ListNode", CycleList: "ListNode", JoinList: "ListNode", NodeIndex: "ListNode", TreeNode: "TreeNode", TreeRef: "TreeNode", TreeVal: "TreeNode", RandomList: "_Node" })[t] || "any";
};
/** 签名里用到的节点类型：决定模板开头要不要带力扣那段注释掉的节点定义 */
const nodeKinds = (sig) => {
  const all = [...(sig.params || []), sig.ret, ...(sig.ctor || []), ...Object.values(sig.methods || {}).flatMap(([ps, r]) => [...ps, r])].filter(Boolean);
  const base = (t) => itemType(t) ? base(itemType(t)) : t;
  const kinds = new Set(all.map(base));
  return {
    list: ["ListNode", "CycleList", "JoinList", "NodeIndex"].some((k) => kinds.has(k)),
    tree: ["TreeNode", "TreeRef", "TreeVal"].some((k) => kinds.has(k)),
    random: kinds.has("RandomList"),
  };
};
const DEFS = {
  python: {
    list: "# Definition for singly-linked list.\n# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\n",
    tree: "# Definition for a binary tree node.\n# class TreeNode:\n#     def __init__(self, val=0, left=None, right=None):\n#         self.val = val\n#         self.left = left\n#         self.right = right\n",
    random: "\"\"\"\n# Definition for a Node.\nclass Node:\n    def __init__(self, x: int, next: 'Node' = None, random: 'Node' = None):\n        self.val = int(x)\n        self.next = next\n        self.random = random\n\"\"\"\n\n",
  },
  javascript: {
    list: "/**\n * Definition for singly-linked list.\n * function ListNode(val, next) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.next = (next===undefined ? null : next)\n * }\n */\n",
    tree: "/**\n * Definition for a binary tree node.\n * function TreeNode(val, left, right) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.left = (left===undefined ? null : left)\n *     this.right = (right===undefined ? null : right)\n * }\n */\n",
    random: "/**\n * // Definition for a _Node.\n * function _Node(val, next, random) {\n *    this.val = val;\n *    this.next = next;\n *    this.random = random;\n * };\n */\n\n",
  },
  typescript: {
    list: "/**\n * Definition for singly-linked list.\n * class ListNode {\n *     val: number\n *     next: ListNode | null\n *     constructor(val?: number, next?: ListNode | null) {\n *         this.val = (val===undefined ? 0 : val)\n *         this.next = (next===undefined ? null : next)\n *     }\n * }\n */\n\n",
    tree: "/**\n * Definition for a binary tree node.\n * class TreeNode {\n *     val: number\n *     left: TreeNode | null\n *     right: TreeNode | null\n *     constructor(val?: number, left?: TreeNode | null, right?: TreeNode | null) {\n *         this.val = (val===undefined ? 0 : val)\n *         this.left = (left===undefined ? null : left)\n *         this.right = (right===undefined ? null : right)\n *     }\n * }\n */\n\n",
    random: "/**\n * Definition for _Node.\n * class _Node {\n *     val: number\n *     next: _Node | null\n *     random: _Node | null\n *\n *     constructor(val?: number, next?: _Node, random?: _Node) {\n *         this.val = (val===undefined ? 0 : val)\n *         this.next = (next===undefined ? null : next)\n *         this.random = (random===undefined ? null : random)\n *     }\n * }\n */\n\n",
  },
};

/**
 * 力扣模式的起始代码：和力扣网站上一模一样——开头是注释掉的节点定义，方法体留空，
 * 不加 import（运行环境和力扣一样预先导入了 typing、collections、heapq 等），也不加 raise / throw。
 */
function leetcodeTemplate(signature, parameterNames, language, methodNames = {}) {
  const sig = signature;
  const names = (types, isConstructor = false) => types.map((_, i) => isConstructor && sig.cls === "LRUCache" ? "capacity" : ["key", "value"][i] || `arg${i + 1}`);
  const kinds = nodeKinds(sig), defs = DEFS[language];
  const head = (kinds.random ? defs.random : "") + (kinds.list ? defs.list : "") + (kinds.tree ? defs.tree : "");
  const methods = Object.entries(sig.methods || {});
  const ctorNames = names(sig.ctor || [], true);
  const usage = (comment, prefix) => {
    let n = 0;
    const lines = [`${prefix}Your ${sig.cls} object will be instantiated and called as such:`, `${prefix}${comment === "#" ? "obj" : "var obj"} = ${comment === "#" ? "" : "new "}${sig.cls}(${ctorNames.join(", ")})`];
    for (const [method, [ps, ret]] of methods) {
      const call = `obj.${language === "python" ? sig.pythonMethods?.[method] || method : method}(${(methodNames[method] || names(ps)).join(",")})`;
      lines.push(prefix + (ret === "void" ? call : `${comment === "#" ? "" : "var "}param_${++n} = ${call}`));
    }
    return lines;
  };
  if (language === "python") {
    if (sig.cls) {
      return head + `class ${sig.cls}:\n\n    def __init__(self${ctorNames.map((n, i) => `, ${n}: ${pyType(sig.ctor[i])}`).join("")}):\n        \n` + methods.map(([method, [params, ret]]) => {
        const ps = methodNames[method] || names(params);
        return `\n    def ${sig.pythonMethods?.[method] || method}(self${params.map((p, i) => `, ${ps[i]}: ${pyType(p)}`).join("")}) -> ${pyType(ret)}:\n        \n`;
      }).join("") + "\n\n" + usage("#", "# ").join("\n") + "\n";
    }
    return head + `class Solution:\n    def ${sig.pythonFn || sig.fn}(self${sig.params.map((t, i) => `, ${parameterNames[i]}: ${pyType(t)}`).join("")}) -> ${pyType(sig.ret)}:\n        `;
  }
  const doc = (ps, ns, ret) => (!ps.length && !ret ? "" : `/**\n${ps.map((t, i) => ` * @param {${jsDocType(t)}} ${ns[i]}\n`).join("")}${ret ? ` * @return {${jsDocType(ret)}}\n` : ""} */\n`);
  const usageBlock = "/**\n" + usage("//", " * ").join("\n") + "\n */\n";
  if (language === "javascript") {
    if (sig.cls) {
      return doc(sig.ctor || [], ctorNames, null) + `var ${sig.cls} = function(${ctorNames.join(", ")}) {\n  \n};\n` + methods.map(([method, [ps, ret]]) => {
        const ns = methodNames[method] || names(ps);
        return `\n${doc(ps, ns, ret)}${sig.cls}.prototype.${method} = function(${ns.join(", ")}) {\n  \n};\n`;
      }).join("") + "\n" + usageBlock;
    }
    return head + doc(sig.params, parameterNames, sig.ret) + `var ${sig.fn} = function(${parameterNames.join(", ")}) {\n  \n};`;
  }
  const typed = (ps, ns) => ps.map((t, i) => `${ns[i]}: ${tsType(t)}`).join(", ");
  if (sig.cls) {
    return `class ${sig.cls} {\n  constructor(${typed(sig.ctor || [], ctorNames)}) {\n    \n  }\n` + methods.map(([method, [ps, ret]]) => `\n  ${method}(${typed(ps, methodNames[method] || names(ps))}): ${tsType(ret)} {\n    \n  }\n`).join("") + "}\n\n" + usageBlock;
  }
  return head + `function ${sig.fn}(${typed(sig.params, parameterNames)}): ${tsType(sig.ret)} {\n  \n};`;
}

/** 上一版的力扣模式起始代码（带 from typing import * 和 raise / throw）。只用来认出没改过的旧草稿，换成新模板 */
function previousLeetcodeTemplate(signature, parameterNames, language, methodNames = {}) {
  const sig = signature;
  const names = (types, isConstructor = false) => types.map((_, i) => isConstructor && sig.cls === "LRUCache" ? "capacity" : ["key", "value"][i] || `arg${i + 1}`);
  if (language === "python") {
    const header = "from typing import *\n\n# ListNode、TreeNode、Node 由测试环境提供。\n";
    if (sig.cls) {
      const ctorNames = names(sig.ctor || [], true);
      return header + `class ${sig.cls}:\n    def __init__(self${ctorNames.map((n, i) => `, ${n}: ${pyType(sig.ctor[i])}`).join("")}):\n        # 初始化数据结构\n        pass\n` + Object.entries(sig.methods).map(([method, [params, ret]]) => {
        const ps = methodNames[method] || names(params);
        return `\n    def ${sig.pythonMethods?.[method] || method}(self${params.map((p, i) => `, ${ps[i]}: ${pyType(p)}`).join("")}) -> ${pyType(ret)}:\n        raise NotImplementedError("请完成此方法")\n`;
      }).join("");
    }
    return header + `class Solution:\n    def ${sig.pythonFn || sig.fn}(self${sig.params.map((t, i) => `, ${parameterNames[i]}: ${pyType(t)}`).join("")}) -> ${pyType(sig.ret)}:\n        # 在这里编写解法\n        raise NotImplementedError("请完成解法")\n`;
  }
  const typed = language === "typescript";
  const params = (ps, ns) => ps.map((t, i) => `${ns[i]}${typed ? `: ${tsType(t)}` : ""}`).join(", ");
  if (sig.cls) {
    return `// ListNode、TreeNode、_Node 由测试环境提供。\nclass ${sig.cls} {\n  constructor(${params(sig.ctor || [], names(sig.ctor || [], true))}) {\n    // 初始化数据结构\n  }\n` + Object.entries(sig.methods).map(([method, [ps, ret]]) => `\n  ${method}(${params(ps, methodNames[method] || names(ps))})${typed ? `: ${tsType(ret)}` : ""} {\n    throw new Error("请完成此方法");\n  }\n`).join("") + "}\n";
  }
  return `// ListNode、TreeNode、_Node 由测试环境提供。\nfunction ${sig.fn}(${params(sig.params, parameterNames)})${typed ? `: ${tsType(sig.ret)}` : ""} {\n  // 在这里编写解法\n  throw new Error("请完成解法");\n}\n`;
}

function javascriptPrelude(signature) {
  return `// 标准输入工具；数组、链表和树在 solve 中均使用题面规定的值序列。\nconst __signature = ${JSON.stringify(signature)};\nconst __lines = require("fs").readFileSync(0, "utf8").replace(/\\r/g, "").split("\\n");\nlet __line = 0;\nfunction __item(t) { return t.endsWith("[]") ? t.slice(0, -2) : /^List<(.+)>$/.exec(t)?.[1]; }\nfunction __atom(s, t) {\n  if (t === "string" || t === "char") return s;\n  if (t === "bool") return s === "true" || s === "1";\n  if (s === "null" || (t === "NodeIndex" && s === "-1")) return null;\n  return Number(s);\n}\nfunction __read(t) {\n  if (t === "ListNode") return __read("int[]");\n  if (t === "TreeNode") return __read("nullable-int[]");\n  if (t === "CycleList" || t === "JoinList") return [__read("int[]"), __read("int")];\n  if (t === "RandomList") { const n = Number(__lines[__line++]); return Array.from({ length: n }, () => { const [v, r] = __lines[__line++].trim().split(/\\s+/).map(Number); return [v, r === -1 ? null : r]; }); }\n  const item = __item(t);\n  if (!item) return __atom(__lines[__line++], t);\n  const n = Number(__lines[__line++]);\n  if (["int", "long", "double", "bool", "char", "nullable-int"].includes(item)) {\n    const tokens = [];\n    while (tokens.length < n) tokens.push(...__lines[__line++].trim().split(/\\s+/).filter(Boolean));\n    return tokens.map(s => __atom(s, item));\n  }\n  return Array.from({ length: n }, () => __read(item));\n}\nfunction __format(v, t) {\n  if (t === "ListNode") return __format(v || [], "int[]");\n  if (t === "TreeNode") return __format(v || [], "nullable-int[]");\n  if (t === "RandomList") return [String(v.length), ...v.map(([x, r]) => x + " " + (r == null ? -1 : r))];\n  const item = __item(t);\n  if (item) {\n    if (["int", "long", "double", "bool", "char", "nullable-int"].includes(item)) return [String(v.length), ...(v.length ? [v.map(x => x == null ? "null" : String(x)).join(" ")] : [])];\n    return [String(v.length), ...v.flatMap(x => __format(x, item))];\n  }\n  return [v == null ? (t === "NodeIndex" ? "-1" : "null") : String(v)];\n}\n`;
}

function javascriptEpilogue(signature) {
  if (signature.cls) return `\nconst operations = [], argumentsList = [];\nconst count = Number(__lines[__line++]);\nfor (let i = 0; i < count; i++) {\n  const [name, ...args] = __lines[__line++].trim().split(/\\s+/);\n  const types = i === 0 ? __signature.ctor : __signature.methods[name][0];\n  operations.push(name);\n  argumentsList.push(args.map((v, j) => __atom(v, types[j])));\n}\nconst answer = solve(operations, argumentsList);\nconsole.log(answer.map(v => v == null ? "null" : String(v)).join("\\n"));\n`;
  return `\nconst args = __signature.params.map(__read);\nconst answer = solve(...args);\nconsole.log(__format(answer, ${JSON.stringify(outType(signature))}).join("\\n"));\n`;
}

function pythonPrelude(signature) {
  return `import sys\n\n# 数组、链表和树在 solve 中均使用题面规定的值序列。\n_SIGNATURE = ${JSON.stringify(signature).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False")}\n_lines = sys.stdin.read().replace("\\r", "").split("\\n")\n_line = 0\n\ndef _item(t):\n    return t[:-2] if t.endswith("[]") else t[5:-1] if t.startswith("List<") else None\n\ndef _atom(s, t):\n    if t in ("string", "char"):\n        return s\n    if t == "bool":\n        return s in ("true", "1")\n    if s == "null" or (t == "NodeIndex" and s == "-1"):\n        return None\n    return float(s) if t == "double" else int(s)\n\ndef _next():\n    global _line\n    result = _lines[_line]\n    _line += 1\n    return result\n\ndef _read(t):\n    if t == "ListNode":\n        return _read("int[]")\n    if t == "TreeNode":\n        return _read("nullable-int[]")\n    if t in ("CycleList", "JoinList"):\n        return [_read("int[]"), _read("int")]\n    if t == "RandomList":\n        result = []\n        for _ in range(int(_next())):\n            value, random = map(int, _next().split())\n            result.append([value, None if random == -1 else random])\n        return result\n    item = _item(t)\n    if item is None:\n        return _atom(_next(), t)\n    count = int(_next())\n    if item in ("int", "long", "double", "bool", "char", "nullable-int"):\n        tokens = []\n        while len(tokens) < count:\n            tokens.extend(_next().split())\n        return [_atom(s, item) for s in tokens]\n    return [_read(item) for _ in range(count)]\n\ndef _text(v, t=""):\n    if v is None:\n        return "-1" if t == "NodeIndex" else "null"\n    if isinstance(v, bool):\n        return "true" if v else "false"\n    return str(v)\n\ndef _format(v, t):\n    if t == "ListNode":\n        return _format(v or [], "int[]")\n    if t == "TreeNode":\n        return _format(v or [], "nullable-int[]")\n    if t == "RandomList":\n        return [str(len(v))] + [str(x) + " " + str(-1 if r is None else r) for x, r in v]\n    item = _item(t)\n    if item:\n        if item in ("int", "long", "double", "bool", "char", "nullable-int"):\n            return [str(len(v))] + ([" ".join(_text(x) for x in v)] if v else [])\n        return [str(len(v))] + [line for x in v for line in _format(x, item)]\n    return [_text(v, t)]\n`;
}

function pythonEpilogue(signature) {
  if (signature.cls) return `\noperations, arguments = [], []\nfor i in range(int(_next())):\n    name, *values = _next().split()\n    types = _SIGNATURE["ctor"] if i == 0 else _SIGNATURE["methods"][name][0]\n    operations.append(name)\n    arguments.append([_atom(v, t) for v, t in zip(values, types)])\nanswer = solve(operations, arguments)\nsys.stdout.write("\\n".join(_text(v) for v in answer) + "\\n")\n`;
  return `\narguments = [_read(t) for t in _SIGNATURE["params"]]\nanswer = solve(*arguments)\nsys.stdout.write("\\n".join(_format(answer, ${JSON.stringify(outType(signature))})) + "\\n")\n`;
}

function legacyAcmTemplate(signature, parameterNames, language) {
  const names = signature.cls ? ["operations", "arguments"] : parameterNames;
  if (language === "python") return `# 编写 solve；下方已提供标准输入输出，可直接修改。\ndef solve(${names.join(", ")}):\n    # 返回题面要求的结果${signature.ret === "void" ? "（返回修改后的序列或矩阵）" : ""}\n    raise NotImplementedError("请完成解法")\n\n` + pythonPrelude(signature) + pythonEpilogue(signature);
  const typed = language === "typescript";
  const solve = `// 编写 solve；下方已提供标准输入输出，可直接修改。\nfunction solve(${names.map((n) => n === "arguments" ? "argumentsList" : n).map(n => n + (typed ? ": any" : "")).join(", ")})${typed ? ": any" : ""} {\n  // 返回题面要求的结果${signature.ret === "void" ? "（返回修改后的序列或矩阵）" : ""}\n  throw new Error("请完成解法");\n}\n\n`;
  // TypeScript is transpiled in the browser. Keep I/O helpers readable JS and opt them out of editor diagnostics.
  return (typed ? "// @ts-nocheck\n" : "") + solve + javascriptPrelude(signature) + javascriptEpilogue(signature);
}

function previousAcmTemplate(_signature, _parameterNames, language) {
  if (language === "python") return "import sys\n\ndef main():\n    # 从 sys.stdin 读取输入，使用 print 输出答案\n    pass\n\nif __name__ == \"__main__\":\n    main()\n";
  return `const fs = require("fs");\nconst input${language === "typescript" ? ": string" : ""} = fs.readFileSync(0, "utf8");\n\n// 按题面解析 input，在这里编写解法\n// 使用 console.log 输出答案\n`;
}

function acmTemplate() {
  return "";
}

function starterHash(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

module.exports = { leetcodeTemplate, previousLeetcodeTemplate, acmTemplate, legacyAcmTemplate, previousAcmTemplate, starterHash, javascriptPrelude, javascriptEpilogue, pythonPrelude, pythonEpilogue };
