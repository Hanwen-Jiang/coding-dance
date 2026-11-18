// C++：每段代码一个可执行文件（前置头文件 + 题解 + 生成的 main），前置头文件预编译一次，后面的编译就快了。
const fs = require("fs"), path = require("path");
const { run, pool, hasTool, parseLines, usesType, cores } = require("../util");

const prelude = fs.readFileSync(path.join(__dirname, "../prelude/prelude.h"), "utf8");
const BASE = {
  int: "int", long: "long long", double: "double", bool: "bool", string: "string", char: "char", ListNode: "ListNode*", TreeNode: "TreeNode*",
  CycleList: "ListNode*", JoinList: "ListNode*", NodeIndex: "ListNode*", TreeRef: "TreeNode*", TreeVal: "TreeNode*", RandomList: "Node*",
};

// 138 的节点类（和力扣的定义一样）和它的构造、输出。只在用到 RandomList 时带上，免得和题解自己写的 Node 类冲突
const NODE = `
class Node {
public:
    int val;
    Node* next;
    Node* random;

    Node(int _val) {
        val = _val;
        next = NULL;
        random = NULL;
    }
};

static vector<Node*> jMade;
static Node* jRandom(const vector<pair<int, int>>& d) {
    jMade.clear();
    for (auto& p : d) jMade.push_back(new Node(p.first));
    for (size_t i = 0; i < d.size(); i++) {
        jMade[i]->next = i + 1 < d.size() ? jMade[i + 1] : nullptr;
        jMade[i]->random = d[i].second == JNUL ? nullptr : jMade[d[i].second];
    }
    return jMade.empty() ? nullptr : jMade[0];
}
static string jsRandom(Node* head) {
    unordered_map<Node*, int> idx;
    for (Node* p = head; p && idx.size() < 100000; p = p->next) { int k = idx.size(); idx.emplace(p, k); }
    unordered_set<Node*> old(jMade.begin(), jMade.end());
    vector<string> out;
    for (Node* p = head; p && out.size() < 100000; p = p->next) {
        if (old.count(p)) return js(string("没有复制：返回了原链表的节点"));
        string r = !p->random ? string("null") : idx.count(p->random) ? to_string(idx[p->random]) : js(string("?"));
        out.push_back("[" + to_string(p->val) + "," + r + "]");
    }
    return jJoin(out);
}
`;
/** 返回值序列化成 JSON 的表达式 */
const outExpr = (t, e) => (t.base === "NodeIndex" ? `jIndex(${e})` : t.base === "TreeVal" ? `jVal(${e})` : t.base === "RandomList" ? `jsRandom(${e})` : `js(${e})`);
const ct = (t) => (t.base ? BASE[t.base] : `vector<${ct(t.arr)}>`);
const ch = (c) => (c === "'" ? "'\\''" : c === "\\" ? "'\\\\'" : `'${c}'`);
const str = (s) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
const FLAGS = ["-std=c++20", "-O1", "-w"];

function lit(t, v) {
  if (t.arr) return `${ct(t)}{${v.map((x) => lit(t.arr, x)).join(", ")}}`;
  switch (t.base) {
    case "long": return `${v}LL`;
    case "double": return Number.isInteger(v) ? `${v}.0` : String(v);
    case "bool": return v ? "true" : "false";
    case "string": return `string(${str(v)})`;
    case "char": return ch(v);
    case "ListNode": return `jList(vector<int>{${v.join(", ")}})`;
    case "TreeNode": return `jTree(vector<int>{${v.map((x) => (x === null ? "JNUL" : x)).join(", ")}})`;
    case "CycleList": return `jCycle(vector<int>{${v[0].join(", ")}}, ${v[1] === null ? -1 : v[1]})`;
    case "JoinList": return `jJoinList(vector<int>{${v[0].join(", ")}}, ${v[1] === null ? -1 : v[1]})`;
    case "TreeRef": return `jFind(${v})`;
    case "RandomList": return `jRandom(vector<pair<int, int>>{${v.map(([x, r]) => `{${x}, ${r === null ? "JNUL" : r}}`).join(", ")}})`;
    default: return String(v);
  }
}

/** 一个用例的语句；emit 把「结果的 JSON 字符串表达式」变成输出它的语句（练习的远端运行器换成带分隔标记的输出） */
function caseBody(sig, c, emit = (json) => `cout << ${json} << endl;`) {
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const L = ['vector<string> out{"null"};', `${sig.cls}* obj = new ${sig.cls}(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")});`];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj->${ops[k]}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}; out.push_back("null");` : `out.push_back(${outExpr(m.ret, call)});`);
    }
    return L.concat(emit("jJoin(out)"));
  }
  const L = c.map((v, i) => `${ct(sig.params[i])} a${i} = ${lit(sig.params[i], v)};`), call = `sol.${sig.fn}(${c.map((_, i) => `a${i}`).join(", ")})`;
  L.push("Solution sol;");
  if (sig.ret.base === "void") return L.concat(`${call};`, emit(outExpr(sig.params[sig.out], `a${sig.out}`)));
  return L.concat(emit(outExpr(sig.ret, call)));
}

const source = (job) => `#include "prelude.h"
${usesType(job.sig, "RandomList") ? NODE : ""}
${job.code}

${job.cases.map((c, k) => `static void jCase${k}() {\n    jReset();\n    ${caseBody(job.sig, c).join("\n    ")}\n}`).join("\n")}

int main() {
${job.cases.map((_, k) => `    try { jCase${k}(); } catch (const exception& e) { cout << "{\\"__error\\":" << js(string(e.what())) << "}" << endl; } catch (...) { cout << "{\\"__error\\":\\"exception\\"}" << endl; }`).join("\n")}
    return 0;
}
`;

module.exports = {
  id: "cpp",
  /** 远端运行器（tools/runner）拼练习用的程序时用 */
  parts: { prelude, NODE, caseBody, FLAGS },
  available: () => hasTool("g++"),
  async runAll(jobs, dir) {
    fs.mkdirSync(path.join(dir, "bin"), { recursive: true });
    fs.writeFileSync(path.join(dir, "prelude.h"), prelude);
    fs.rmSync(path.join(dir, "prelude.h.gch"), { force: true });
    const pch = await run("g++", [...FLAGS, "-x", "c++-header", path.join(dir, "prelude.h"), "-o", path.join(dir, "prelude.h.gch")], { timeout: 300000 });
    if (pch.code !== 0) throw new Error("前置头文件编译失败：" + pch.stderr.slice(0, 800));
    const exe = process.platform === "win32" ? ".exe" : "";
    return pool(jobs, cores, async (job) => {
      const file = path.join(dir, `${job.name}.cpp`), bin = path.join(dir, "bin", job.name + exe);
      fs.writeFileSync(file, source(job));
      const b = await run("g++", [...FLAGS, "-I", dir, "-o", bin, file], { timeout: 300000 });
      if (b.code !== 0) return { error: "编译没过：" + b.stderr.split("\n").filter((l) => /error/.test(l)).slice(0, 4).map((l) => l.replace(/^.*?\.cpp:/, "")).join(" | ") };
      const r = await run(bin, []);
      return { outputs: parseLines(r.stdout, job.cases.length, r.timedOut ? "超时" : r.code !== 0 ? `程序崩溃了（退出码 ${r.code}）` : "") };
    });
  },
};
