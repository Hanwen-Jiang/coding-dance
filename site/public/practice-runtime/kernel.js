/* Browser-only judge helpers. No host process or filesystem is exposed. */
(function () {
  function ListNode(val = 0, next = null) { this.val = val; this.next = next; }
  function TreeNode(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; }
  function RandomNode(val = 0, next = null, random = null) { this.val = val; this.next = next; this.random = random; }
  function makeJudge() {
    const nodes = [], oldRandom = new Set(); let tree = null;
    function list(values) {
      const dummy = new ListNode(); let p = dummy;
      for (const value of values) { p = p.next = new ListNode(value); nodes.push(p); }
      return dummy.next;
    }
    function mkTree(values) {
      if (!values.length || values[0] === null) return null;
      const root = new TreeNode(values[0]), queue = [root]; let i = 1;
      for (let h = 0; h < queue.length && i < values.length; h++) for (const side of ["left", "right"]) {
        if (i >= values.length) break;
        const value = values[i++];
        if (value !== null) queue.push(queue[h][side] = new TreeNode(value));
      }
      return root;
    }
    function input(type, value) {
      if (type === "ListNode") return list(value);
      if (type === "ListNode[]") return value.map(list);
      if (type === "CycleList") { const start = nodes.length, head = list(value[0]); if (value[1] != null && value[1] >= 0 && value[0].length) nodes[nodes.length - 1].next = nodes[start + value[1]]; return head; }
      if (type === "JoinList") { const tail = value[1] != null && value[1] >= 0 ? nodes[value[1]] : null, head = list(value[0]); if (!head) return tail; nodes[nodes.length - 1].next = tail; return head; }
      if (type === "TreeNode") return tree = mkTree(value);
      if (type === "TreeRef") { const queue = [tree]; while (queue.length) { const node = queue.pop(); if (!node) continue; if (node.val === value) return node; queue.push(node.left, node.right); } return null; }
      if (type === "RandomList") { const ns = value.map(([v]) => new RandomNode(v)); ns.forEach((n, i) => { oldRandom.add(n); n.next = ns[i + 1] || null; n.random = value[i][1] === null ? null : ns[value[i][1]]; }); return ns[0] || null; }
      return JSON.parse(JSON.stringify(value));
    }
    function output(type, value) {
      if (type === "ListNode") { const out = [], seen = new Set(); while (value) { if (seen.has(value)) throw Error("输出链表存在环"); if (out.length >= 100000) throw Error("输出链表过长"); seen.add(value); out.push(value.val); value = value.next; } return out; }
      if (type === "TreeNode") { const out = [], q = [value], seen = new Set(); for (let i = 0; i < q.length; i++) { const n = q[i]; if (!n) { out.push(null); continue; } if (seen.has(n) || q.length > 100000) throw Error("输出不是有限二叉树"); seen.add(n); out.push(n.val); q.push(n.left, n.right); } while (out.length && out[out.length - 1] === null) out.pop(); return out; }
      if (type === "NodeIndex") { if (value == null) return null; const i = nodes.indexOf(value); if (i < 0) throw Error("返回节点不属于输入链表"); return i; }
      if (type === "TreeVal") return value == null ? null : value.val;
      if (type === "RandomList") { const ns = [], seen = new Map(); for (let n = value; n; n = n.next) { if (seen.has(n) || ns.length > 100000) throw Error("输出随机链表存在环"); if (oldRandom.has(n)) throw Error("应深拷贝链表，不能返回原节点"); seen.set(n, ns.length); ns.push(n); } return ns.map((n) => { if (n.random != null && !seen.has(n.random)) throw Error("random 指向输出链表之外"); return [n.val, n.random == null ? null : seen.get(n.random)]; }); }
      if (value === undefined) return null;
      const serialized = JSON.stringify(value, (_key, item) => { if (typeof item === "number" && !Number.isFinite(item)) throw Error("返回结果含 NaN 或 Infinity"); return item; });
      if (serialized.length > 1000000) throw Error("返回结果过大");
      return JSON.parse(serialized);
    }
    return { input, output };
  }
  function executeJavaScript(code, mode, signature, test) {
    let stdout = "";
    class ProgramExit extends Error { constructor(code) { super(`程序退出，状态码 ${code}`); this.code = code; } }
    function write(value) { const s = String(value); if (stdout.length + s.length > 16384) throw Error("标准输出超过 16 KB，请减少调试输出"); stdout += s; }
    const log = (...args) => write(args.map((v) => typeof v === "string" ? v : JSON.stringify(v)).join(" ") + "\n");
    const console = { log, info: log, warn: log, error: log, debug: log, clear() {} };
    const stdin = test.stdin || ""; let lineIndex = 0;
    const lines = stdin.replace(/\r/g, "").split("\n");
    const fs = Object.freeze({ readFileSync: (file) => { if (file !== 0 && file !== "/dev/stdin") throw Error("仅允许读取标准输入"); return stdin; } });
    const process = Object.freeze({ stdin: { read: () => stdin }, stdout: { write }, stderr: { write }, exit: (code = 0) => { throw new ProgramExit(code); }, env: Object.freeze({}) });
    const require = (name) => { if (["fs", "node:fs"].includes(name)) return fs; throw Error("浏览器中只支持 require('fs') 读取标准输入"); };
    const judge = makeJudge();
    let source = code;
    try {
    function compile(extraNames, extraValues, body) {
      // Put supplied node classes in an outer lexical scope. User declarations
      // can shadow them, and commented LeetCode node definitions stay harmless.
      return new Function(...extraNames, "__nodeTypes", '"use strict"; return (function(ListNode, TreeNode, _Node, Node) { return (function() { "use strict";\n' + body + '\n}).call(undefined); })(...__nodeTypes);')(...extraValues, [ListNode, TreeNode, RandomNode, RandomNode]);
    }
    if (mode === "acm") {
      // Allow the common Node ESM stdin import while keeping all other imports unavailable.
      source = source.replace(/^\s*import\s+\{\s*readFileSync(?:\s+as\s+(\w+))?\s*\}\s+from\s*["'](?:node:)?fs["'];?\s*$/gm, (_, alias) => `const ${alias || "readFileSync"} = require("fs").readFileSync;`);
      source = source.replace(/^\s*import\s+(\w+)\s+from\s*["'](?:node:)?fs["'];?\s*$/gm, 'const $1 = require("fs");');
      const exports = {}, module = { exports };
      compile(["console", "require", "process", "readline", "print", "exports", "module"], [console, require, process, () => lineIndex < lines.length ? lines[lineIndex++] : null, log, exports, module], source);
      return { actual: null, stdout };
    }
    const target = signature.cls || signature.fn;
    if (!/^[A-Za-z_$][\w$]*$/.test(target || "")) throw Error("题目函数签名无效");
    const suffix = signature.cls ? `\nreturn typeof ${target} === "function" ? ${target} : null;` : `\nreturn typeof ${target} === "function" ? ${target} : (typeof Solution !== "undefined" ? new Solution()[${JSON.stringify(target)}]?.bind(new Solution()) : null);`;
    const fn = compile(["console"], [console], source + suffix);
    if (typeof fn !== "function") throw Error(`没有找到 ${target}，请保留模板中的函数名`);
    let actual;
    if (signature.cls) {
      const [ops, argv] = test.input;
      const obj = new fn(...argv[0].map((v, i) => judge.input((signature.ctor || [])[i], v)));
      actual = [null];
      for (let i = 1; i < ops.length; i++) { const spec = signature.methods[ops[i]], result = obj[ops[i]](...argv[i].map((v, j) => judge.input(spec[0][j], v))); actual.push(spec[1] === "void" ? null : judge.output(spec[1], result)); }
    } else {
      const args = test.input.map((v, i) => judge.input(signature.params[i], v)), result = fn(...args);
      actual = signature.ret === "void" ? judge.output(signature.params[signature.out || 0], args[signature.out || 0]) : judge.output(signature.ret, result);
    }
    return { actual, stdout };
    } catch (error) {
      if (mode === "acm" && error instanceof ProgramExit && error.code === 0) return { actual: null, stdout };
      return { actual: null, stdout, error: String(error?.message || error) };
    }
  }
  globalThis.PracticeKernel = { executeJavaScript };
})();
