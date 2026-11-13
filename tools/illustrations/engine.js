(function () {
  const $ = (id) => document.getElementById(id);
  const E = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const INV = new Set(["a", "b", "c"]);
  const lab = (v) => (v.label ? `<div class="vl">${v.label}</div>` : "");
  const norm = (it) => (it !== null && typeof it === "object" ? it : { v: it });
  const show = (x) => (x === null || x === undefined ? "" : E(x));

  function ptrMap(ptrs) {
    const m = {};
    for (const [name, i] of Object.entries(ptrs || {})) if (i !== null && i !== undefined) (m[i] = m[i] || []).push(name);
    return m;
  }
  function vArray(v) {
    const pm = ptrMap(v.ptrs), hasP = v.ptrs !== undefined;
    const cols = v.items.map(norm).map((it, i) =>
      `<div class="cc"><div class="cell ${it.cls || ""}">${show(it.v)}</div>` +
      (v.idx === false ? "" : `<div class="ci">${v.idxFrom ? i + v.idxFrom : i}</div>`) +
      (hasP ? `<div class="cp">${(pm[i] || []).map((n) => `<span>${E(n)}</span>`).join("")}</div>` : "") + `</div>`).join("");
    return `<div class="v">${lab(v)}<div class="scroll"><div class="arr">${cols}</div></div></div>`;
  }
  function vBars(v) {
    const items = v.items.map(norm), pm = ptrMap(v.ptrs);
    const max = Math.max(1, ...items.map((it) => it.v + (it.water || 0)), v.max || 0);
    const cols = items.map((it, i) =>
      `<div class="cc"><div class="bar-slot">` +
      (it.v / max < 0.16 ? `<div class="bv">${it.v}</div>` : "") +
      (it.water ? `<div class="wat" style="height:${(it.water / max) * 100}%"></div>` : "") +
      `<div class="bar ${it.cls || ""}" style="height:${(it.v / max) * 100}%">${it.v / max < 0.16 ? "" : it.v}</div></div>` +
      `<div class="ci">${i}</div><div class="cp">${(pm[i] || []).map((n) => `<span>${E(n)}</span>`).join("")}</div></div>`).join("");
    return `<div class="v">${lab(v)}<div class="scroll"><div class="arr">${cols}</div></div></div>`;
  }
  function vGrid(v) {
    const n = v.rows[0].length;
    let h = `<span class="ax"></span>` + v.rows[0].map((_, j) => `<span class="ax">${j}</span>`).join("");
    v.rows.forEach((r, i) => {
      h += `<span class="ax">${i}</span>` + r.map(norm).map((it) => `<div class="cell ${it.cls || ""}">${show(it.v)}</div>`).join("");
    });
    return `<div class="v">${lab(v)}<div class="scroll"><div class="grid" style="grid-template-columns:18px repeat(${n},40px)">${h}</div></div></div>`;
  }
  function vChips(v) {
    const items = v.items.map(norm);
    return `<div class="v">${lab(v)}<div class="chips">${items.length ? items.map((it) => `<span class="chip ${it.cls || ""}">${show(it.v)}</span>`).join("") : `<span class="empty">${v.empty || "空"}</span>`}</div></div>`;
  }
  let uid = 0;
  function vList(v) {
    const nodes = v.nodes.map(norm), n = nodes.length, GAP = 62, BW = 40, BH = 32, X0 = 14, Y = 44;
    const W = X0 * 2 + n * GAP + 24, H = 104, id = "ah" + uid++;
    const cx = (i) => X0 + i * GAP + BW / 2;
    let s = `<defs><marker id="${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker></defs>`;
    const next = v.next || nodes.map((_, i) => (i + 1 < n ? i + 1 : null));
    const edge = (i, j, cls, lift) => {
      if (j === null || j === undefined) return;
      if (j === -1) { s += `<line class="edge ${cls}" x1="${cx(i) + BW / 2}" y1="${Y}" x2="${cx(i) + BW / 2 + 12}" y2="${Y}"></line><text class="nil" x="${cx(i) + BW / 2 + 20}" y="${Y}">∅</text>`; return; }
      if (j === i + 1) s += `<line class="edge ${cls}" marker-end="url(#${id})" x1="${cx(i) + BW / 2}" y1="${Y - 4}" x2="${cx(j) - BW / 2 - 2}" y2="${Y - 4}"></line>`;
      else if (j === i - 1) s += `<line class="edge ${cls}" marker-end="url(#${id})" x1="${cx(i) - BW / 2}" y1="${Y + 6}" x2="${cx(j) + BW / 2 + 2}" y2="${Y + 6}"></line>`;
      else if (j === i) s += `<path class="edge ${cls}" marker-end="url(#${id})" d="M${cx(i) - 8} ${Y - BH / 2} C${cx(i) - 18} ${Y - 40} ${cx(i) + 18} ${Y - 40} ${cx(i) + 8} ${Y - BH / 2 - 2}"></path>`;
      else { const up = lift ? -1 : j > i ? -1 : 1, y0 = Y + up * (BH / 2), h = Math.min(30, 14 + Math.abs(j - i) * 4);
        s += `<path class="edge ${cls}" marker-end="url(#${id})" d="M${cx(i)} ${y0} Q${(cx(i) + cx(j)) / 2} ${y0 + up * h * 1.6} ${cx(j) + (j > i ? -6 : 6)} ${y0 + up * 2}"></path>`; }
    };
    next.forEach((j, i) => { if (!nodes[i].hide) edge(i, j === null && v.showNil !== false && !nodes[i].noNil ? -1 : j, nodes[i].ecls || "", false); });
    (v.extra || []).forEach(([i, j]) => edge(i, j, "warm", j > i));
    const pm = ptrMap(v.ptrs);
    nodes.forEach((nd, i) => {
      if (nd.hide) return;
      const c = (nd.cls || "").split(" ")[0];
      s += `<rect class="n ${nd.cls || ""}" x="${cx(i) - BW / 2}" y="${Y - BH / 2}" width="${BW}" height="${BH}" rx="6"></rect>`;
      s += `<text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${cx(i)}" y="${Y}">${show(nd.v)}</text>`;
      (pm[i] || []).forEach((nm, k) => { s += `<text class="pt" x="${cx(i)}" y="${Y + BH / 2 + 12 + k * 13}">${E(nm)}</text>`; });
    });
    return `<div class="v">${lab(v)}<div class="scroll"><svg class="g2" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:none"><g>${s}</g></svg></div></div>`;
  }
  function vTree(v) {
    const pos = {}, par = {}; let x = 0, depth = 0;
    const walk = (id, d) => { if (id === null || id === undefined || !v.nodes[id]) return; const nd = v.nodes[id];
      walk(nd.l, d + 1); pos[id] = [28 + x * 46, 28 + d * 66]; x++; depth = Math.max(depth, d); walk(nd.r, d + 1);
      for (const c of [nd.l, nd.r]) if (c !== null && c !== undefined && v.nodes[c]) par[c] = id; };
    walk(v.root, 0);
    const W = Math.max(56 + (x - 1) * 46, 120), H = 56 + depth * 66 + (v.badges ? 22 : 0);
    const cls = v.cls || {}, on = new Set(v.on || []);
    let s = "";
    for (const id in par) { const [x1, y1] = pos[par[id]], [x2, y2] = pos[id];
      s += `<line class="edge ${on.has(+id) && on.has(+par[id]) ? "on" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`; }
    for (const id in pos) { const [px, py] = pos[id], c = (cls[id] || "").split(" ")[0];
      s += `<circle class="n ${cls[id] || ""}" cx="${px}" cy="${py}" r="17"></circle><text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${px}" y="${py}">${show(v.nodes[id].v)}</text>`;
      const b = v.badges && v.badges[id];
      if (b !== undefined && b !== null) { const t = String(b), w = Math.max(26, t.length * 7 + 10);
        s += `<rect class="bd" x="${px - w / 2}" y="${py + 21}" width="${w}" height="16" rx="8"></rect><text class="bt" x="${px}" y="${py + 29}">${E(t)}</text>`; }
    }
    return `<div class="v">${lab(v)}<div class="scroll"><svg class="g2" viewBox="0 0 ${W} ${H}" style="width:${W * 1.15}px;max-width:100%"><g>${s}</g></svg></div></div>`;
  }
  const R = { array: vArray, bars: vBars, grid: vGrid, chips: vChips, list: vList, tree: vTree, note: (v) => `<div class="v">${lab(v)}<div>${v.html}</div></div>` };

  let steps = [], idx = 0, timer = null;
  function render() {
    const s = steps[idx];
    $("views").innerHTML = s.views.map((v) => R[v.t](v)).join("");
    const f = $("facts");
    f.hidden = !(s.facts && s.facts.length);
    f.innerHTML = (s.facts || []).map(([k, val]) => `<div class="fact"><span class="fk">${E(k)}</span><span class="fv${String(val).length > 6 ? " long" : ""}">${E(val)}</span></div>`).join("");
    const ph = $("phase");
    ph.textContent = s.phase;
    ph.className = "phase" + (s.kind ? " " + s.kind : "");
    $("msg").innerHTML = s.msg;
    $("slider").max = steps.length - 1; $("slider").value = idx;
    $("stepno").textContent = `${idx} / ${steps.length - 1}`;
    $("prev").disabled = idx === 0; $("next").disabled = idx === steps.length - 1;
  }
  function go(i) { idx = Math.max(0, Math.min(steps.length - 1, i)); render(); }
  function stop() { if (timer) clearInterval(timer); timer = null; $("play").textContent = "自动播放"; }
  function play() {
    if (timer) return stop();
    if (idx === steps.length - 1) go(0);
    $("play").textContent = "暂停";
    timer = setInterval(() => { if (idx >= steps.length - 1) return stop(); go(idx + 1); }, 1100);
  }
  function load(k) {
    stop();
    const p = SPEC.presets[k];
    steps = [];
    SPEC.build(p.args, (phase, msg, views, o) => steps.push({ phase, msg, views, ...(o || {}) }));
    document.querySelectorAll("#presets button").forEach((b, i) => b.setAttribute("aria-pressed", String(i === k)));
    $("inote").textContent = p.note || "";
    go(0);
  }
  $("presets").innerHTML = SPEC.presets.map((p, i) => `<button type="button" id="pre${i}" aria-pressed="false">${E(p.label)}</button>`).join("");
  SPEC.presets.forEach((_, i) => { $("pre" + i).onclick = () => load(i); });
  $("reset").onclick = () => { stop(); go(0); };
  $("prev").onclick = () => { stop(); go(idx - 1); };
  $("next").onclick = () => { stop(); go(idx + 1); };
  $("play").onclick = play;
  $("slider").oninput = (e) => { stop(); go(Number(e.target.value)); };
  load(0);
})();
