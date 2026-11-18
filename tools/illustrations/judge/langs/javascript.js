// JavaScript 和 TypeScript：前置代码 + 题解 + 一段读用例、调用、输出 JSON 的脚本，用 node 直接跑。
// TypeScript 靠 node 自带的类型擦除运行；找得到 tsc 时另外做一遍 --strict 类型检查。
const fs = require("fs"), path = require("path");
const { run, pool, hasTool, parseLines, flatSig, usesType, cores } = require("../util");

// 138 的节点类，和力扣的定义一样（JS/TS 里叫 _Node）。只在用到 RandomList 时带上
const NODE = {
  js: `function _Node(val, next, random) {
  this.val = val;
  this.next = next;
  this.random = random;
}
__judge.mkNode = (v) => new _Node(v, null, null);
`,
  ts: `class _Node {
  val: number;
  next: _Node | null;
  random: _Node | null;
  constructor(val?: number, next?: _Node, random?: _Node) {
    this.val = val === undefined ? 0 : val;
    this.next = next === undefined ? null : next;
    this.random = random === undefined ? null : random;
  }
}
__judge.mkNode = (v: number) => new _Node(v);
`,
};
const extra = (job, ext) => (usesType(job.sig, "RandomList") ? NODE[ext] : "");

/** 运行脚本；ts 为真时给变量标上 any，这样同一段脚本在 .ts 文件里也合法 */
function runner(sig, ts) {
  const A = ts ? ": any" : "", N = ts ? ": number" : "";
  const target = sig.kind === "design" ? sig.cls : sig.fn;
  return `
;(function () {
  const { sig, cases } = JSON.parse(__read(process.argv[2], "utf8"));
  const target${A} = ${target};
  for (const c of cases) {
    let out${A};
    __judge.reset();
    try {
      if (sig.kind === "design") {
        const [ops, argv] = c;
        const obj${A} = new target(...argv[0].map((v${A}, i${N}) => __judge.in(sig.ctor[i], v)));
        out = [null];
        for (let k = 1; k < ops.length; k++) {
          const m = sig.methods[ops[k]];
          const r = obj[ops[k]](...argv[k].map((v${A}, i${N}) => __judge.in(m.params[i], v)));
          out.push(m.ret === "void" ? null : __judge.out(m.ret, r));
        }
      } else {
        const args = c.map((v${A}, i${N}) => __judge.in(sig.params[i], v));
        const r = target(...args);
        out = sig.ret === "void" ? __judge.out(sig.params[sig.out], args[sig.out]) : __judge.out(sig.ret, r);
      }
    } catch (e${A}) { out = { __error: String((e && e.stack) || e).split("\\n").slice(0, 2).join(" ") }; }
    console.log(JSON.stringify(out));
  }
})();
`;
}

function make(id, ext, head, tail) {
  const prelude = fs.readFileSync(path.join(__dirname, `../prelude/prelude.${ext}`), "utf8");
  const ts = ext === "ts";
  return {
    id,
    /** 远端运行器（tools/runner）拼练习用的程序时用 */
    parts: { prelude, node: NODE[ext], head },
    available: () => hasTool("node"),
    async runAll(jobs, dir, opts = {}) {
      fs.mkdirSync(dir, { recursive: true });
      const res = await pool(jobs, cores, async (job) => {
        const file = path.join(dir, `${job.name}.${ext}`), json = path.join(dir, `${job.name}.json`);
        fs.writeFileSync(file, head + prelude + extra(job, ext) + "\n" + job.code + "\n" + runner(job.sig, ts) + tail);
        fs.writeFileSync(json, JSON.stringify({ sig: flatSig(job.sig), cases: job.cases }));
        const r = await run("node", [file, json]);
        return { outputs: parseLines(r.stdout, job.cases.length, r.timedOut ? "超时" : r.stderr.trim().split("\n").slice(0, 6).join(" | ")) };
      });
      if (ts) await typeCheck(jobs, dir, res, prelude, opts);
      return res;
    },
  };
}

/** tsc --strict：只检查「前置代码 + 题解」，不带运行脚本。TSC 环境变量可以指到 typescript/bin/tsc */
async function typeCheck(jobs, dir, res, prelude, opts) {
  const tsc = process.env.TSC ? ["node", process.env.TSC] : hasTool("tsc", ["-v"]) ? ["tsc"] : null;
  if (!tsc) {
    if (opts.require) throw new Error("找不到 tsc：装上 typescript，或者把 TSC 设成 typescript/bin/tsc 的路径");
    console.log("  （找不到 tsc，跳过 TypeScript 的类型检查；可以设 TSC=<typescript/bin/tsc 的路径>）");
    return;
  }
  const cdir = path.join(dir, "check");
  fs.rmSync(cdir, { recursive: true, force: true });
  fs.mkdirSync(cdir, { recursive: true });
  for (const job of jobs) fs.writeFileSync(path.join(cdir, `${job.name}.ts`), prelude + extra(job, "ts") + "\n" + job.code + "\nexport {};\n");
  const files = jobs.map((j) => path.join(cdir, `${j.name}.ts`));
  const r = await run(tsc[0], [...tsc.slice(1), "--noEmit", "--strict", "--target", "es2022", "--lib", "es2022", "--pretty", "false", ...files], { timeout: 300000 });
  // 题解从前置代码之后开始，报错的行号要减掉这么多
  const offset = Object.fromEntries(jobs.map((j) => [j.name, (prelude + extra(j, "ts")).split("\n").length]));
  const byJob = {};
  for (const line of (r.stdout + "\n" + r.stderr).split(/\r?\n/)) {
    const m = line.match(/([\w-]+)\.ts\((\d+),\d+\): error (TS\d+: .*)$/);
    if (m) (byJob[m[1]] = byJob[m[1]] || []).push(`第 ${Number(m[2]) - (offset[m[1]] || 0)} 行 ${m[3]}`);
  }
  jobs.forEach((job, i) => { if (byJob[job.name]) res[i].error = "类型检查没过：" + byJob[job.name].slice(0, 5).join("；"); });
  if (r.code !== 0 && !Object.keys(byJob).length) throw new Error("tsc 运行失败：" + (r.stdout + r.stderr).slice(0, 500));
}

module.exports = {
  javascript: make("javascript", "js", 'const { readFileSync: __read } = require("fs");\n', ""),
  typescript: make("typescript", "ts", 'import { readFileSync as __read } from "node:fs";\n', "export {};\n"),
};
