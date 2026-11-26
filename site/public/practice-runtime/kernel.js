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
  /*
   * 调试记录（配合 instrument.js 改写过的源码）：__step 记下执行到哪一行、当时的变量，__ret 记返回值，
   * __enter / __exit 维护调用栈，__exc 记异常。最多记 LIMIT 步，记满了就抛 StepLimit 让程序停下。格式和 Python 的一样。
   */
  const TRACE_LIMIT = 1000, TRACE_BYTES = 600000;
  class StepLimit extends Error {}
  function show(v, depth = 0) {
    try {
      if (v === undefined) return "undefined";
      if (v === null) return "null";
      const t = typeof v;
      if (t === "string") return JSON.stringify(v.length > 60 ? v.slice(0, 59) + "…" : v);
      if (t === "number" || t === "boolean") return String(v);
      if (t === "bigint") return v + "n";
      if (t === "function") return v.name ? `ƒ ${v.name}` : "ƒ";
      if (t === "symbol") return String(v);
      if (v instanceof ListNode) { const out = [], seen = new Set(); let n = v; while (n && out.length < 12) { if (seen.has(n)) { out.push("…（有环）"); break; } seen.add(n); out.push(show(n.val, 3)); n = n.next; } if (n && out.length >= 12 && !seen.has(n)) out.push("…"); return `ListNode(${out.join(" → ")})`; }
      if (v instanceof TreeNode) return `TreeNode(${show(v.val, 3)})`;
      if (v instanceof RandomNode) return `Node(${show(v.val, 3)})`;
      if (depth >= 3) return Array.isArray(v) ? "[…]" : "{…}";
      const list = (items, size, open, close) => `${open}${items.join(", ")}${size > items.length ? ", …" : ""}${close}`;
      if (Array.isArray(v)) return list(v.slice(0, 12).map((x) => show(x, depth + 1)), v.length, "[", "]");
      if (ArrayBuffer.isView(v)) return `${v.constructor.name}(${v.length}) ` + list([...v.slice(0, 12)].map(String), v.length, "[", "]");
      if (v instanceof Map) return `Map(${v.size}) ` + list([...v].slice(0, 10).map(([k, x]) => `${show(k, depth + 1)} => ${show(x, depth + 1)}`), v.size, "{", "}");
      if (v instanceof Set) return `Set(${v.size}) ` + list([...v].slice(0, 10).map((x) => show(x, depth + 1)), v.size, "{", "}");
      const keys = Object.keys(v), name = v.constructor && v.constructor !== Object ? v.constructor.name + " " : "";
      return name + list(keys.slice(0, 10).map((k) => `${k}: ${show(v[k], depth + 1)}`), keys.length, "{", "}");
    } catch { return "<无法显示>"; }
  }
  function makeTracer(outLength) {
    const steps = [], stack = [];
    let full = false, bytes = 0, lastId = 0, evaluatingWatch = false;
    const record = (step) => {
      steps.push(step);
      bytes += JSON.stringify(step).length;
      if (steps.length >= TRACE_LIMIT || bytes > TRACE_BYTES) full = true;
    };
    const vars = (getters) => {
      const out = [];
      for (const [name, get] of Object.entries(getters || {})) {
        let value;
        try { value = get(); } catch { continue; } // 还没声明到（暂时性死区）或者不在作用域里
        if (typeof value === "function") continue;
        if (name === "this") {
          // 设计类题：把 this 上的字段一个个列出来
          if (value && typeof value === "object") for (const k of Object.keys(value).slice(0, 12)) { let x; try { x = value[k]; } catch { continue; } if (typeof x !== "function") out.push([`this.${k}`, show(x)]); }
          continue;
        }
        out.push([name, show(value)]);
        if (out.length >= 40) break;
      }
      return out;
    };
    const evalWatches = (watchGetters) => {
      if (!Array.isArray(watchGetters) || !watchGetters.length) return [];
      const out = [];
      evaluatingWatch = true;
      try {
        for (const [expr, get] of watchGetters) {
          let value;
          try { value = get(); } catch { continue; }
          if (typeof value === "function") continue;
          out.push([expr, show(value)]);
        }
      } finally {
        evaluatingWatch = false;
      }
      return out;
    };
    const unpack = (snapResult) => {
      if (snapResult && typeof snapResult === "object" && "vars" in snapResult && "watches" in snapResult) {
        return snapResult;
      }
      return { vars: snapResult, watches: null };
    };
    const where = (line) => { if (stack.length) stack[stack.length - 1][1] = line; return stack.length ? stack[stack.length - 1][0] : "<module>"; };
    const frames = () => stack.map(([n, l]) => [n, l]);
    const hooks = {
      __snap: (getters, watchGetters) => ({ vars: getters, watches: watchGetters }),
      __step(line, snap, id) {
        if (evaluatingWatch) return;
        if (full) throw new StepLimit("step limit");
        const fn = where(line), { vars: vGetters, watches: wGetters } = unpack(snap());
        const w = evalWatches(wGetters);
        const step = { line, event: "line", fn, stack: frames(), vars: vars(vGetters), out: outLength(), ...(w.length ? { watches: w } : {}) };
        // 同一行上紧挨着的两条不同语句（比如 if (…) return …），变量也没变：只算一步。同一条语句反复执行（循环）照常每次都记
        const last = steps[steps.length - 1];
        if (last && last.event === "line" && lastId !== id && JSON.stringify(last) === JSON.stringify(step)) { lastId = id; return; }
        lastId = id;
        record(step);
      },
      __ret(line, snap, value) {
        if (evaluatingWatch) return value;
        if (!full) {
          const fn = where(line), { vars: vGetters, watches: wGetters } = unpack(snap());
          const w = evalWatches(wGetters);
          record({ line, event: "return", fn, stack: frames(), vars: vars(vGetters), out: outLength(), ...(w.length ? { watches: w } : {}), ret: show(value) });
        }
        return value;
      },
      __enter(name) { if (!evaluatingWatch) stack.push([name, 0]); },
      __exit() { if (!evaluatingWatch) stack.pop(); },
      __exc(error) {
        if (evaluatingWatch || full || error instanceof StepLimit || !stack.length) return;
        const [fn, line] = stack[stack.length - 1];
        if (steps.length && steps[steps.length - 1].event === "exception" && steps[steps.length - 1].exc === String(error?.message || error)) return; // 往外层传的同一个异常只记一次
        record({ line, event: "exception", fn, stack: frames(), vars: [], out: outLength(), exc: `${error?.name || "Error"}: ${error?.message || error}` });
      },
    };
    return { hooks, trace: () => ({ steps, truncated: full, limit: TRACE_LIMIT }) };
  }

  function executeJavaScript(code, mode, signature, test, debug = false) {
    let stdout = "";
    const tracer = debug ? makeTracer(() => stdout.length) : null;
    const hookNames = tracer ? Object.keys(tracer.hooks) : [], hookValues = tracer ? Object.values(tracer.hooks) : [];
    const withTrace = (result) => (tracer ? { ...result, trace: tracer.trace() } : result);
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
      // 调试时再加上记录用的几个函数（__step 这些，见 makeTracer）
      return new Function(...extraNames, ...hookNames, "__nodeTypes", '"use strict"; return (function(ListNode, TreeNode, _Node, Node) { return (function() { "use strict";\n' + body + '\n}).call(undefined); })(...__nodeTypes);')(...extraValues, ...hookValues, [ListNode, TreeNode, RandomNode, RandomNode]);
    }
    if (mode === "acm") {
      // Allow the common Node ESM stdin import while keeping all other imports unavailable.
      source = source.replace(/^\s*import\s+\{\s*readFileSync(?:\s+as\s+(\w+))?\s*\}\s+from\s*["'](?:node:)?fs["'];?\s*$/gm, (_, alias) => `const ${alias || "readFileSync"} = require("fs").readFileSync;`);
      source = source.replace(/^\s*import\s+(\w+)\s+from\s*["'](?:node:)?fs["'];?\s*$/gm, 'const $1 = require("fs");');
      const exports = {}, module = { exports };
      compile(["console", "require", "process", "readline", "print", "exports", "module"], [console, require, process, () => lineIndex < lines.length ? lines[lineIndex++] : null, log, exports, module], source);
      return withTrace({ actual: null, stdout });
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
    return withTrace({ actual, stdout });
    } catch (error) {
      if (mode === "acm" && error instanceof ProgramExit && error.code === 0) return withTrace({ actual: null, stdout });
      if (error instanceof StepLimit) return withTrace({ actual: null, stdout, error: `调试最多记录 ${TRACE_LIMIT} 步，程序停在了这里（没有运行完）。可以换一组小一点的输入再调试` });
      return withTrace({ actual: null, stdout, error: String(error?.message || error) });
    }
  }
  globalThis.PracticeKernel = { executeJavaScript };
})();
