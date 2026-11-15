// 判题：把每道题每种语言的题解都编译、运行，和 Python 标准解法给出的答案比对。
// 用法：node tools/illustrations/judge/run.js [--lang java,cpp] [--require] [题号或专题名…]
//   不写 --lang 就跑本机装了工具链的所有语言；--require：没装工具链算失败（CI 用）。
//   用例在 tools/illustrations/cases/ 里，由 build.js 导出；改了 spec 的 sig / call 之后先跑一遍 build。
const fs = require("fs"), path = require("path"), os = require("os");
const { ROOT, LANGS, parseCode, pad4, codesOf } = require("./code");
const { normSig, matches } = require("./util");

const MODS = {
  python: require("./langs/python"),
  java: require("./langs/java"),
  cpp: require("./langs/cpp"),
  go: require("./langs/go"),
  ...require("./langs/javascript"),
};

/** 所有要判的代码：题目 spec 里带 sig 的，加上专题里带 sig 的小节 */
function collect(only) {
  const units = [];
  const want = (name) => !only.length || only.includes(String(name));
  const specDir = path.join(ROOT, "specs");
  for (const f of fs.readdirSync(specDir).sort()) {
    if (!f.endsWith(".js")) continue;
    const S = require(path.join(specDir, f));
    if (!S.sig || !want(S.id)) continue;
    units.push({ name: pad4(S.id), label: `${S.id} ${S.name}`, sig: S.sig, codes: codesOf(S.codes, pad4(S.id)), casesFile: path.join(ROOT, "cases", `${pad4(S.id)}.json`) });
  }
  const topicDir = path.join(ROOT, "topics");
  if (fs.existsSync(topicDir)) for (const f of fs.readdirSync(topicDir).sort()) {
    if (!f.endsWith(".js")) continue;
    const T = require(path.join(topicDir, f));
    if (!want(T.slug)) continue;
    for (const sec of T.sections || []) {
      if (!sec.sig || !sec.codes) continue;
      units.push({ name: `${T.slug}_${sec.key}`, label: `专题 ${T.name} · ${sec.t}`, sig: sec.sig, codes: codesOf(sec.codes, path.join("topics", T.slug)).map((c) => ({ ...c, key: c.i === 0 ? sec.key : c.key })), casesFile: path.join(ROOT, "cases", "topics", `${T.slug}.${sec.key}.json`) });
    }
  }
  return units;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const require_ = argv.includes("--require");
  const only = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--lang");
  const langs = (flag("--lang") || LANGS.map((l) => l.id).join(",")).split(",").filter(Boolean);
  const units = collect(only);
  if (!units.length) { console.log("没有带 sig 的题目"); return; }
  let bad = 0;
  for (const lang of langs) {
    const mod = MODS[lang];
    if (!mod) throw new Error(`不认识的语言：${lang}`);
    if (!mod.available()) {
      if (require_) { console.log(`✗ ${lang}：本机没有它的工具链`); bad++; } else console.log(`- ${lang}：本机没有它的工具链，跳过（CI 上会跑）`);
      continue;
    }
    const jobs = [];
    for (const u of units) {
      if (!fs.existsSync(u.casesFile)) throw new Error(`${u.label}：还没有用例文件，先跑 node tools/illustrations/build.js`);
      const { cases } = JSON.parse(fs.readFileSync(u.casesFile, "utf8"));
      for (const c of u.codes) {
        if (!c.raw[lang] || !c.judge) continue;
        jobs.push({ name: `${u.name}_${c.key || "c" + c.i}`, label: `${u.label} · ${c.t}`, sig: normSig(u.sig), cases: cases.map((x) => x.in), expect: cases.map((x) => x.out), code: parseCode(c.raw[lang]).code });
      }
    }
    if (!jobs.length) { console.log(`- ${lang}：没有代码`); continue; }
    const dir = path.join(os.tmpdir(), "lc-judge", lang);
    const t0 = Date.now();
    const res = await mod.runAll(jobs, dir, { require: require_ });
    let fail = 0;
    jobs.forEach((job, i) => {
      const r = res[i];
      if (r.error) { fail++; console.log(`  ✗ ${job.label}\n      ${r.error}`); return; }
      const k = job.expect.findIndex((e, n) => !matches(e, r.outputs[n], job.sig.cmp));
      if (k < 0) return;
      fail++;
      const got = r.outputs[k];
      console.log(`  ✗ ${job.label}\n      输入 ${JSON.stringify(job.cases[k]).slice(0, 300)}\n      期望 ${JSON.stringify(job.expect[k]).slice(0, 300)}\n      得到 ${got && got.__error ? "出错：" + got.__error : JSON.stringify(got).slice(0, 300)}`);
    });
    console.log(`${fail ? "✗" : "✓"} ${lang}：${jobs.length - fail} / ${jobs.length} 段代码通过（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
    bad += fail;
  }
  if (bad) process.exit(1);
}

if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exit(1); });
module.exports = { MODS };
