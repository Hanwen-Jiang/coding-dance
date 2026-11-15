// C++：每段代码一个可执行文件（前置头文件 + 题解 + 生成的 main），前置头文件预编译一次，后面的编译就快了。
const fs = require("fs"), path = require("path");
const { run, pool, hasTool, parseLines, cores } = require("../util");

const prelude = fs.readFileSync(path.join(__dirname, "../prelude/prelude.h"), "utf8");
const BASE = { int: "int", long: "long long", double: "double", bool: "bool", string: "string", char: "char", ListNode: "ListNode*", TreeNode: "TreeNode*" };
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
    default: return String(v);
  }
}

function caseBody(sig, c) {
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const L = ['vector<string> out{"null"};', `${sig.cls}* obj = new ${sig.cls}(${argv[0].map((v, i) => lit(sig.ctor[i], v)).join(", ")});`];
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], call = `obj->${ops[k]}(${argv[k].map((v, i) => lit(m.params[i], v)).join(", ")})`;
      L.push(m.ret.base === "void" ? `${call}; out.push_back("null");` : `out.push_back(js(${call}));`);
    }
    return L.concat("cout << jJoin(out) << endl;");
  }
  const L = c.map((v, i) => `${ct(sig.params[i])} a${i} = ${lit(sig.params[i], v)};`), call = `sol.${sig.fn}(${c.map((_, i) => `a${i}`).join(", ")})`;
  L.push("Solution sol;");
  if (sig.ret.base === "void") return L.concat(`${call};`, `cout << js(a${sig.out}) << endl;`);
  return L.concat(`cout << js(${call}) << endl;`);
}

const source = (job) => `#include "prelude.h"

${job.code}

${job.cases.map((c, k) => `static void jCase${k}() {\n    ${caseBody(job.sig, c).join("\n    ")}\n}`).join("\n")}

int main() {
${job.cases.map((_, k) => `    try { jCase${k}(); } catch (const exception& e) { cout << "{\\"__error\\":" << js(string(e.what())) << "}" << endl; } catch (...) { cout << "{\\"__error\\":\\"exception\\"}" << endl; }`).join("\n")}
    return 0;
}
`;

module.exports = {
  id: "cpp",
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
