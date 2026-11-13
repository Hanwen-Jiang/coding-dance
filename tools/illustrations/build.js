// 生成 illustrations/<编号>.<题名>.html。用法：node tools/illustrations/build.js [题号...]
const fs = require("fs"), path = require("path"), cp = require("child_process"), os = require("os");
const dir = __dirname, out = path.join(dir, "../../illustrations");
const css = fs.readFileSync(path.join(dir, "style.css"), "utf8");
const engine = fs.readFileSync(path.join(dir, "engine.js"), "utf8");
const prelude = fs.readFileSync(path.join(dir, "pytest_prelude.py"), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const codeHtml = (code) => esc(code.replace(/^\n+|\s+$/g, "")).split("\n")
  .map((l) => l.replace(/(^|\s)(#(?!['"]).*)$/, (m, a, b) => `${a}<span class="cmt">${b}</span>`)).join("\n");
const only = process.argv.slice(2).map(Number);
let n = 0;
for (const f of fs.readdirSync(path.join(dir, "specs")).sort()) {
  if (!f.endsWith(".js")) continue;
  const S = require(path.join(dir, "specs", f));
  if (only.length && !only.includes(S.id)) continue;
  // 1) 演示：每个预设都跑一遍，核对最后一步给出的答案
  for (const p of S.presets) {
    const steps = [];
    S.build(p.args, (phase, msg, views, o) => steps.push({ phase, msg, views, ...(o || {}) }));
    if (!steps.length) throw new Error(`${S.id} ${p.label}: no steps`);
    for (const s of steps) if (typeof s.phase !== "string" || typeof s.msg !== "string" || !Array.isArray(s.views)) throw new Error(`${S.id} ${p.label}: bad step`);
    const got = JSON.stringify(steps[steps.length - 1].ans);
    if (got !== JSON.stringify(p.expect)) throw new Error(`${S.id} ${p.label}: demo answer ${got} != ${JSON.stringify(p.expect)}`);
  }
  // 2) 代码：每段 Python 代码都跑一遍测试
  for (const c of S.codes) {
    const t = c.test === undefined ? S.pytest : c.test;
    if (!t) throw new Error(`${S.id}: code "${c.t}" has no test`);
    const tmp = path.join(os.tmpdir(), `ill_${S.id}_${Math.random().toString(36).slice(2)}.py`);
    fs.writeFileSync(tmp, prelude + "\n" + c.code + "\n" + t + "\n");
    try { cp.execFileSync("python3", [tmp], { stdio: ["ignore", "pipe", "pipe"] }); }
    catch (e) { throw new Error(`${S.id}: python test failed for "${c.t}"\n${e.stderr}`); }
    finally { fs.unlinkSync(tmp); }
  }
  const det = (lvl, t, body) => `      <details>\n        <summary><span class="lvl">${lvl}</span>${t}<span class="peek">点开</span></summary>\n        <div class="hint-body">\n${body}\n        </div>\n      </details>`;
  const hints = S.hints.map((h, i) => det(`提示 ${i + 1}`, h.t, h.body.map((p) => `          <p>${p}</p>`).join("\n")));
  const codes = S.codes.map((c) => det("代码", c.t, (c.note ? `          <p>${c.note}</p>\n` : "") + `<pre class="code">${codeHtml(c.code)}</pre>`));
  const legend = (S.legend || []).map(([cls, t]) => `<span><i class="sw ${cls}"></i>${t}</span>`).join("");
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
        <div class="legend">${legend}</div>
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
const SPEC = { presets: ${JSON.stringify(S.presets.map(({ label, args, note }) => ({ label, args, note })))}, ${S.build.toString()} };
${engine}</script>
`;
  fs.writeFileSync(path.join(out, `${String(S.id).padStart(4, "0")}.${S.name}.html`), html);
  n++;
  console.log("ok", S.id, S.name);
}
console.log(`built ${n}`);
