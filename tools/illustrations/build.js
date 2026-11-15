// 生成 illustrations/<编号>.<题名>.html，并把提示、代码、注意点导出到 tools/illustrations/data/<编号>.json（网站读这份数据）。
// 用法：node tools/illustrations/build.js [题号...]        只导出数据、跳过测试和页面：加 --data-only
// 随机演示的输入在 random.js 里；build 时每题随机 40 组输入，演示的答案要和标准 Python 解法一致。
// 代码行尾的 #@tag / //@tag 是「步骤标记」，演示里每一步用 at 指到它（见 judge/code.js）；其他语言的代码在 code/ 里。
// 带 sig 的题还会导出判题用例到 cases/，各语言的代码用 node tools/illustrations/judge/run.js 验证。
const fs = require("fs"), path = require("path"), cp = require("child_process"), os = require("os");
const { makeR, GEN, randomSource } = require("./random");
const { parseCode, pad4, codesOf, markMismatch } = require("./judge/code");
const { normSig } = require("./judge/util");
const pyJudge = require("./judge/langs/python");
const dir = __dirname, out = path.join(dir, "../../illustrations"), dataDir = path.join(dir, "data"), casesDir = path.join(dir, "cases");
const dataOnly = process.argv.includes("--data-only");
// --strict：每种演示解法都必须有带标记的代码（全部题目都做完标记之后，CI 用这个开关）
const strict = process.argv.includes("--strict");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(casesDir, { recursive: true });
/**
 * 一道题的所有演示解法：第一个是 spec 自己的 build（名字是 S.method），后面是 S.alts 里的其他解法。
 * 所有解法共用同一套预设和随机输入，答案都要对。
 * code 是这种解法对应的那段代码的 key：第一种对应标准解法（std），其他解法在 alts[].code 里写。
 */
const methodsOf = (S) => (S.handwritten ? [] : [
  { t: S.method || "标准解法", note: S.methodNote || null, legend: S.legend || [], build: S.build, code: "std" },
  ...(S.alts || []).map((m) => ({ t: m.t, note: m.note || null, legend: m.legend || S.legend || [], build: m.build, code: m.code || null })),
]);
/** 导出给网站的代码：去掉标记，带上 tag → 行号，以及其他语言的版本 */
const exportCodes = (entries) => entries.map((e) => {
  const py = parseCode(e.raw.python), langs = {};
  for (const [lang, raw] of Object.entries(e.raw)) if (lang !== "python") langs[lang] = parseCode(raw);
  return {
    t: e.t, kind: e.kind, note: e.note, ...(e.key ? { key: e.key } : {}), code: py.code,
    ...(Object.keys(py.marks).length ? { marks: py.marks } : {}),
    ...(Object.keys(langs).length ? { langs } : {}),
  };
});
/**
 * 函数的源码。Windows 上检出的文件可能是 CRLF 换行，函数源码会原样带上；统一成 LF，
 * 这样不管在哪个系统上 build，导出的数据和页面都一模一样（CI 会核对）。
 */
const src = (f) => String(f).replace(/\r\n/g, "\n");
const exportData = (S) => {
  const methods = methodsOf(S);
  fs.writeFileSync(path.join(dataDir, `${pad4(S.id)}.json`), JSON.stringify({
    id: S.id, name: S.name, level: S.level, topic: S.topic, h1: S.h1, lede: S.lede, handwritten: !!S.handwritten,
    hints: S.hints, points: S.points,
    codes: exportCodes(codesOf(S.codes, pad4(S.id))),
    // 逐步演示：网站上的播放器会执行 build 生成每一步，渲染方式和 engine.js 一致
    demo: S.handwritten ? null : {
      title: S.demoTitle || "逐步演示",
      legend: methods[0].legend,
      presets: S.presets.map(({ label, args, note }) => ({ label, args, note: note || "" })),
      build: src(methods[0].build),
      // 多种解法：网站上可以切换；code 是对应代码的 key，播放器按它显示代码、高亮当前这一步的行
      methods: methods.map((m) => ({ t: m.t, note: m.note, legend: m.legend, ...(m.code ? { code: m.code } : {}), build: src(m.build) })),
      // 「随机」：一段自包含的函数源码，调用后返回 { args, note }
      random: randomSource(S.id) && src(randomSource(S.id)),
    },
  }, null, 1) + "\n");
};
/**
 * 核对演示的每一步都指到了代码里的标记：at 不能缺，写的 tag 在这种解法的代码里要有。
 * 代码还没加标记的题先跳过（--strict 时不允许）。
 */
function checkAt(S, entries, m, steps, where) {
  const e = m.code ? entries.find((x) => x.key === m.code) : null;
  if (m.code && !e) throw new Error(`${S.id} [${m.t}]: 找不到 key 是 "${m.code}" 的代码`);
  const marks = e ? parseCode(e.raw.python).marks : {};
  if (!Object.keys(marks).length) {
    if (strict) throw new Error(`${S.id} [${m.t}]: 这种解法的代码还没有步骤标记`);
    if (steps.some((s) => s.at != null)) throw new Error(`${S.id} [${m.t}]: 演示里写了 at，但代码里没有标记`);
    return;
  }
  steps.forEach((s, k) => {
    // 确实不对应任何代码的步骤（比如设计类题最后的总结）要明确写 at: []
    if (s.at == null) throw new Error(`${S.id} [${m.t}] ${where}: 第 ${k} 步「${s.phase}」没有写 at`);
    for (const t of [].concat(s.at)) if (!marks[t]) throw new Error(`${S.id} [${m.t}] ${where}: 第 ${k} 步「${s.phase}」的 at "${t}" 在代码里没有对应的标记`);
  });
}
/** 固定种子的随机数：导出判题用例时用，同一份 spec 每次导出的用例都一样 */
const mulberry32 = (a) => () => { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/**
 * 导出判题用例：预设 + spec 里手写的 cases + 10 组固定种子的随机输入，期望输出用标准解法（Python）算。
 * call(args) 把演示的输入变成力扣的参数列表；gen 是随机输入的生成函数。
 */
function exportCases({ name, label, sig, call, presets, extra, gen, seed, code, file }) {
  const inputs = [], seen = new Set(), H = makeR(); // call 的第二个参数是 makeR() 的工具函数，比如 H.toLc 把堆下标的树转成力扣的层序数组
  const add = (x) => { const k = JSON.stringify(x); if (!seen.has(k)) { seen.add(k); inputs.push(JSON.parse(k)); } };
  for (const p of presets || []) add(call(p.args, H));
  for (const c of extra || []) add(c);
  if (gen) {
    const orig = Math.random;
    Math.random = mulberry32(seed);
    try { const R = makeR(); for (let k = 0; k < 10; k++) add(call(gen(R).args, H)); } finally { Math.random = orig; }
  }
  const outs = pyJudge.runSync({ name, sig: normSig(sig), cases: inputs, code }, path.join(os.tmpdir(), "lc-judge", "build"));
  outs.forEach((o, i) => { if (o && typeof o === "object" && !Array.isArray(o) && "__error" in o) throw new Error(`${label}: 标准解法跑判题用例出错：${JSON.stringify(inputs[i])} → ${o.__error}`); });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `{\n "sig": ${JSON.stringify(sig)},\n "cases": [\n${inputs.map((x, i) => "  " + JSON.stringify({ in: x, out: outs[i] })).join(",\n")}\n ]\n}\n`);
}
const runBuild = (build, args) => {
  const steps = [];
  build(JSON.parse(JSON.stringify(args)), (phase, msg, views, o) => steps.push({ phase, msg, views, ...(o || {}) }));
  return steps;
};
// 没装 Python 时可设 PYTHON="node pyrun.js" 之类的替代命令；Windows 上 python3 往往是个空壳，默认用 python
const pyCmd = () => (process.env.PYTHON || (process.platform === "win32" ? "python" : "python3")).split(" ");
const randomPrelude = fs.readFileSync(path.join(dir, "random_prelude.py"), "utf8");
const deepSort = (x) => (Array.isArray(x) ? x.map(deepSort).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) : x);
const same = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9
  : Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => same(x, b[i])) : JSON.stringify(a) === JSON.stringify(b));
/** 随机 n 组输入：每种解法的演示都要能跑完并给出答案，答案要和标准解法（codes[0]）一致 */
function checkRandom(S, entries, n = 40) {
  const R = makeR(), samples = [], methods = methodsOf(S);
  for (let k = 0; k < n; k++) {
    const r = GEN[S.id](R);
    for (const m of methods) {
      const steps = runBuild(m.build, r.args), last = steps[steps.length - 1];
      if (!last || !("ans" in last)) throw new Error(`${S.id} [${m.t}]: random demo gave no answer for ${r.note}`);
      checkAt(S, entries, m, steps, `随机输入 ${r.note}`);
      samples.push({ r, ans: last.ans, m: m.t });
    }
  }
  const script = prelude + "\n" + randomPrelude + "\n" + S.codes[0].code + "\n__res = []\nfor __f in [" + samples.map((s) => `lambda: ${s.r.py}`).join(",\n") + "]:\n    __res.append(__f())\nprint(json.dumps(__res))\n";
  const tmp = path.join(os.tmpdir(), `ill_rand_${S.id}_${Math.random().toString(36).slice(2)}.py`);
  fs.writeFileSync(tmp, script);
  let res;
  try { res = JSON.parse(cp.execFileSync(pyCmd()[0], [...pyCmd().slice(1), tmp], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim().split("\n").pop()); }
  catch (e) { throw new Error(`${S.id}: random check python failed\n${e.stderr || e.message}`); }
  finally { fs.unlinkSync(tmp); }
  samples.forEach((s, i) => {
    let a = s.ans, b = res[i];
    if (s.r.cmp === "unordered") { a = deepSort(a); b = deepSort(b); }
    if (s.r.cmp === "length") a = a.length;
    if (!same(a, b)) throw new Error(`${S.id} [${s.m}]: random demo answer ${JSON.stringify(s.ans)} != python ${JSON.stringify(res[i])} for ${s.r.note}`);
  });
}
const css = fs.readFileSync(path.join(dir, "style.css"), "utf8");
const engine = fs.readFileSync(path.join(dir, "engine.js"), "utf8");
const prelude = fs.readFileSync(path.join(dir, "pytest_prelude.py"), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const codeHtml = (code) => esc(code.replace(/^\n+|\s+$/g, "")).split("\n")
  .map((l) => l.replace(/(^|\s)(#(?!['"]).*)$/, (m, a, b) => `${a}<span class="cmt">${b}</span>`)).join("\n");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number);
let n = 0;
for (const f of fs.readdirSync(path.join(dir, "specs")).sort()) {
  if (!f.endsWith(".js")) continue;
  const S = require(path.join(dir, "specs", f));
  if (only.length && !only.includes(S.id)) continue;
  if (dataOnly) { exportData(S); n++; continue; }
  const entries = codesOf(S.codes, pad4(S.id));
  // 0) 各语言代码里的步骤标记要和 Python 的一致，这样同一份演示能高亮任何语言
  for (const e of entries) { const bad = markMismatch(e); if (bad) throw new Error(`${S.id}「${e.t}」: ${bad}`); }
  // 1) 演示：每种解法、每个预设都跑一遍，核对最后一步给出的答案（handwritten 的页面是手写的，spec 只提供提示和代码，不生成页面）
  for (const m of methodsOf(S)) for (const p of S.presets) {
    const steps = runBuild(m.build, p.args);
    if (!steps.length) throw new Error(`${S.id} [${m.t}] ${p.label}: no steps`);
    for (const s of steps) if (typeof s.phase !== "string" || typeof s.msg !== "string" || !Array.isArray(s.views)) throw new Error(`${S.id} [${m.t}] ${p.label}: bad step`);
    checkAt(S, entries, m, steps, p.label);
    // cmp: "unordered" 的题（比如前 k 个高频元素），不同解法给出的顺序可以不同
    const norm = (x) => JSON.stringify(S.cmp === "unordered" ? deepSort(x) : x);
    const got = norm(steps[steps.length - 1].ans);
    if (got !== norm(p.expect)) throw new Error(`${S.id} [${m.t}] ${p.label}: demo answer ${got} != ${JSON.stringify(p.expect)}`);
  }
  // 2) 代码：每段 Python 代码都跑一遍测试
  for (const c of S.codes) {
    const t = c.test === undefined ? S.pytest : c.test;
    if (!t) throw new Error(`${S.id}: code "${c.t}" has no test`);
    const tmp = path.join(os.tmpdir(), `ill_${S.id}_${Math.random().toString(36).slice(2)}.py`);
    fs.writeFileSync(tmp, prelude + "\n" + c.code + "\n" + t + "\n");
    const py = pyCmd();
    try { cp.execFileSync(py[0], [...py.slice(1), tmp], { stdio: ["ignore", "pipe", "pipe"] }); }
    catch (e) { throw new Error(`${S.id}: python test failed for "${c.t}"\n${e.stderr}`); }
    finally { fs.unlinkSync(tmp); }
  }
  // 3) 随机演示：和标准解法对答案
  if (!S.handwritten) {
    if (!GEN[S.id]) throw new Error(`${S.id}: random.js 里没有这道题的随机输入`);
    checkRandom(S, entries);
  }
  // 4) 判题用例：给各语言的代码用（node tools/illustrations/judge/run.js）
  if (S.sig) {
    if (typeof S.call !== "function") throw new Error(`${S.id}: 写了 sig 就要写 call(args)`);
    exportCases({
      name: pad4(S.id), label: String(S.id), sig: S.sig, call: S.call, presets: S.presets, extra: S.cases, gen: GEN[S.id], seed: S.id * 7919 + 17,
      code: parseCode(S.codes[0].code).code, file: path.join(casesDir, `${pad4(S.id)}.json`),
    });
  } else if (strict) throw new Error(`${S.id}: 还没有写 sig`);
  exportData(S);
  if (S.handwritten) { n++; console.log("ok", S.id, S.name, "(handwritten, tests only)"); continue; }
  const det = (lvl, t, body) => `      <details>\n        <summary><span class="lvl">${lvl}</span>${t}<span class="peek">点开</span></summary>\n        <div class="hint-body">\n${body}\n        </div>\n      </details>`;
  const hints = S.hints.map((h, i) => det(`提示 ${i + 1}`, h.t, h.body.map((p) => `          <p>${p}</p>`).join("\n")));
  const codes = S.codes.map((c) => det("代码", c.t, (c.note ? `          <p>${c.note}</p>\n` : "") + `<pre class="code">${codeHtml(parseCode(c.code).code)}</pre>`));
  const methods = methodsOf(S);
  const legend = methods[0].legend.map(([cls, t]) => `<span><i class="sw ${cls}"></i>${t}</span>`).join("");
  const methodsJs = methods.map((m) => `{ t: ${JSON.stringify(m.t)}, note: ${JSON.stringify(m.note)}, legend: ${JSON.stringify(m.legend)}, ${src(m.build)} }`).join(",\n");
  const html = `<meta charset="utf-8">
<title>${S.title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;800&family=Noto+Sans+SC:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
${css}</style>

<div class="wrap">
  <header>
    <div class="eyebrow">LeetCode ${S.id} · ${S.level} · ${S.topic}</div>
    <h1>${S.h1}</h1>
    <p class="lede">${S.lede}</p>
  </header>

  <section aria-labelledby="h-hints">
    <h2 id="h-hints">分层提示</h2>
    <div class="hints">
${hints.concat(codes).join("\n")}
    </div>
  </section>

  <section aria-labelledby="h-demo">
    <h2 id="h-demo">${S.demoTitle || "逐步演示"}</h2>
    <div class="stage">
      <div class="panel">
        <div class="toolbar"${methods.length > 1 ? "" : " hidden"}><span class="input-note">解法</span><div class="seg" id="methods" role="group" aria-label="选择解法"></div></div>
        <div class="input-note" id="mnote" hidden></div>
        <div class="toolbar"><div class="seg" id="presets" role="group" aria-label="选择示例"></div></div>
        <div class="input-note" id="inote"></div>
        <div class="views" id="views"></div>
        <div class="toolbar">
          <button id="reset" type="button">重置</button>
          <button id="prev" type="button">上一步</button>
          <button id="next" type="button" class="primary">下一步</button>
          <button id="play" type="button">自动播放</button>
        </div>
        <div class="scrub">
          <input id="slider" type="range" min="0" max="0" value="0" aria-label="步骤">
          <span class="mono" id="stepno">0 / 0</span>
        </div>
      </div>
      <div class="log" aria-live="polite">
        <div class="facts" id="facts"></div>
        <span class="phase" id="phase"></span>
        <p class="msg" id="msg"></p>
        <div class="legend" id="legend">${legend}</div>
      </div>
    </div>
  </section>

  <section aria-labelledby="h-points">
    <h2 id="h-points">写代码时注意</h2>
    <div class="points">
${S.points.map((p) => `      <div class="point"><h3>${p.t}</h3><p>${p.body}</p></div>`).join("\n")}
    </div>
  </section>
</div>

<script>
const SPEC = { presets: ${JSON.stringify(S.presets.map(({ label, args, note }) => ({ label, args, note })))}, random: ${randomSource(S.id)}, methods: [
${methodsJs}
] };
${engine}</script>
`;
  fs.writeFileSync(path.join(out, `${pad4(S.id)}.${S.name}.html`), src(html));
  n++;
  console.log("ok", S.id, S.name);
}
console.log(`built ${n}`);
