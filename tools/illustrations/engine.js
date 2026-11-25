(function () {
  const $ = (id) => document.getElementById(id);
  const E = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const INV = new Set(["a", "b", "c"]);
  const lab = (v) => (v.label ? `<div class="vl">${v.label}</div>` : "");
  const norm = (it) => (it !== null && typeof it === "object" ? it : { v: it });
  const show = (x) => (x === null || x === undefined ? "" : E(x));

  function ptrMap(ptrs) {
    const m = {};
    for (const [name, i] of Object.entries(ptrs || {})) if (i !== null && i !== undefined) (m[String(i)] = m[String(i)] || []).push(name);
    return m;
  }
  const cellHtml = (it) => (it.prev !== undefined && String(it.prev) !== String(it.v)
    ? `<span class="prev">${show(it.prev)}→</span><span>${show(it.v)}</span>`
    : show(it.v));
  function vArray(v) {
    const pm = ptrMap(v.ptrs), hasP = v.ptrs !== undefined;
    const cols = v.items.map(norm).map((it, i) =>
      `<div class="cc"><div class="cell ${it.cls || ""}${it.prev !== undefined && String(it.prev) !== String(it.v) ? " changed" : ""}">${cellHtml(it)}</div>` +
      (v.idx === false ? "" : `<div class="ci">${v.labels ? show(v.labels[i]) : v.idxFrom ? i + v.idxFrom : i}</div>`) +
      (hasP ? `<div class="cp">${(pm[String(i)] || []).map((n) => `<span>${E(n)}</span>`).join("")}</div>` : "") + `</div>`).join("");
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
      `<div class="ci">${i}</div><div class="cp">${(pm[String(i)] || []).map((n) => `<span>${E(n)}</span>`).join("")}</div></div>`).join("");
    return `<div class="v">${lab(v)}<div class="scroll"><div class="arr">${cols}</div></div></div>`;
  }
  // rowLabels / colLabels 可以替代行列号（越界的那一行写 -1），ax: false 不画行列号
  function vGrid(v) {
    const n = v.rows[0].length, ax = v.ax !== false;
    const rl = (i) => (v.rowLabels ? show(v.rowLabels[i]) : i), cl = (j) => (v.colLabels ? show(v.colLabels[j]) : j);
    let h = ax ? `<span class="ax"></span>` + v.rows[0].map((_, j) => `<span class="ax">${cl(j)}</span>`).join("") : "";
    v.rows.forEach((r, i) => {
      h += (ax ? `<span class="ax">${rl(i)}</span>` : "") + r.map(norm).map((it) => `<div class="cell ${it.cls || ""}${it.prev !== undefined && String(it.prev) !== String(it.v) ? " changed" : ""}">${cellHtml(it)}</div>`).join("");
    });
    return `<div class="v">${lab(v)}<div class="scroll"><div class="grid" style="grid-template-columns:${ax ? "minmax(18px,auto) " : ""}repeat(${n},40px)">${h}</div></div></div>`;
  }
  function vChips(v) {
    const items = v.items.map(norm);
    return `<div class="v">${lab(v)}<div class="chips">${items.length ? items.map((it) => `<span class="chip ${it.cls || ""}">${show(it.v)}</span>`).join("") : `<span class="empty">${v.empty || "空"}</span>`}</div></div>`;
  }
  let uid = 0;
  function vList(v) {
    const nodes = v.nodes.map(norm), n = nodes.length, GAP = 66, BW = 40, BH = 32, X0 = 30, Y = 46;
    const W = X0 * 2 + n * GAP, H = 108, id = "ah" + uid++, idOn = "ahon" + uid++, idCut = "ahcut" + uid++;
    const cx = (i) => X0 + i * GAP + BW / 2;
    let s = `<defs><marker id="${id}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker><marker id="${idOn}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-on"></path></marker><marker id="${idCut}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-cut"></path></marker></defs>`;
    const next = v.next || nodes.map((_, i) => (i + 1 < n ? i + 1 : null));
    const edge = (i, j, cls, lift, arc) => {
      if (j === null || j === undefined) return;
      if (j === -1) {
        if (i === n - 1) s += `<line class="edge ${cls}" x1="${cx(i) + BW / 2}" y1="${Y}" x2="${cx(i) + BW / 2 + 12}" y2="${Y}"></line><text class="nil" x="${cx(i) + BW / 2 + 20}" y="${Y}">∅</text>`;
        else if (i === 0) s += `<line class="edge ${cls}" x1="${cx(i) - BW / 2}" y1="${Y}" x2="${cx(i) - BW / 2 - 10}" y2="${Y}"></line><text class="nil" x="${cx(i) - BW / 2 - 18}" y="${Y}">∅</text>`;
        else s += `<line class="edge ${cls}" x1="${cx(i)}" y1="${Y - BH / 2}" x2="${cx(i)}" y2="${Y - BH / 2 - 9}"></line><text class="nil" x="${cx(i)}" y="${Y - BH / 2 - 17}">∅</text>`;
        return;
      }
      const mid = (cls || "").includes("cut") ? idCut : (cls || "").includes("on") ? idOn : id;
      if (j === i + 1 && !arc) s += `<line class="edge ${cls}" marker-end="url(#${mid})" x1="${cx(i) + BW / 2}" y1="${Y - 4}" x2="${cx(j) - BW / 2 - 2}" y2="${Y - 4}"></line>`;
      else if (j === i - 1 && !arc) s += `<line class="edge ${cls}" marker-end="url(#${mid})" x1="${cx(i) - BW / 2}" y1="${Y + 6}" x2="${cx(j) + BW / 2 + 2}" y2="${Y + 6}"></line>`;
      else if (j === i) s += `<path class="edge ${cls}" marker-end="url(#${mid})" d="M${cx(i) - 8} ${Y - BH / 2} C${cx(i) - 18} ${Y - 40} ${cx(i) + 18} ${Y - 40} ${cx(i) + 8} ${Y - BH / 2 - 2}"></path>`;
      else { const up = lift ? -1 : j > i ? -1 : 1, y0 = Y + up * (BH / 2), h = Math.min(30, 16 + Math.abs(j - i) * 4);
        s += `<path class="edge ${cls}" marker-end="url(#${mid})" d="M${cx(i)} ${y0} Q${(cx(i) + cx(j)) / 2} ${y0 + up * h * 1.6} ${cx(j) + (j > i ? -6 : 6)} ${y0 + up * 2}"></path>`; }
    };
    (v.ghostEdges || []).forEach(([i, j]) => edge(i, j, "cut", false));
    next.forEach((j, i) => { if (!nodes[i].hide) edge(i, j === null && v.showNil !== false && !nodes[i].noNil ? -1 : j, nodes[i].ecls || "", false); });
    (v.extra || []).forEach(([i, j]) => edge(i, j, "warm", j > i, true));
    const pm = ptrMap(v.ptrs);
    nodes.forEach((nd, i) => {
      if (nd.hide) return;
      const c = (nd.cls || "").split(" ")[0];
      s += `<rect class="n ${nd.cls || ""}" x="${cx(i) - BW / 2}" y="${Y - BH / 2}" width="${BW}" height="${BH}" rx="6"></rect>`;
      s += `<text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${cx(i)}" y="${Y}">${show(nd.v)}</text>`;
      (pm[String(i)] || []).forEach((nm, k) => { s += `<text class="pt" x="${cx(i)}" y="${Y + BH / 2 + 12 + k * 13}">${E(nm)}</text>`; });
    });
    return `<div class="v">${lab(v)}<div class="scroll"><svg class="g2" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:none"><g>${s}</g></svg></div></div>`;
  }
  function vTree(v) {
    const pos = {}, parList = [], pm = ptrMap(v.ptrs);
    const maxPtrLines = Math.max(0, ...Object.values(pm).map((a) => a.length));
    const hasPrev = Object.values(v.nodes || {}).some((nd) => nd && nd.prev !== undefined && String(nd.prev) !== String(nd.v));
    const PAD = v.badges || v.ptrs ? 46 : 32, GAPX = v.badges || v.ptrs ? 54 : 46;
    const ptrHead = maxPtrLines ? 12 + maxPtrLines * 13 : 0, prevHead = hasPrev ? 14 : 0;
    const TOP = 26 + Math.max(ptrHead, prevHead) + (ptrHead && prevHead ? 10 : 0), R = 17;
    const visited = new Set(); let x = 0;
    const walk = (id, d) => { if (id === null || id === undefined) return; const sid = String(id); if (!v.nodes[id] || visited.has(sid)) return; visited.add(sid);
      const nd = v.nodes[id]; walk(nd.l, d + 1); pos[sid] = [PAD + x * GAPX, TOP + d * 66]; x++; walk(nd.r, d + 1);
      if (nd.l !== null && nd.l !== undefined && v.nodes[nd.l]) parList.push([sid, String(nd.l), "L"]);
      if (nd.r !== null && nd.r !== undefined && v.nodes[nd.r]) parList.push([sid, String(nd.r), "R"]); };
    walk(v.root, 0);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const cover = (x0, y0, x1, y1) => { minX = Math.min(minX, x0); minY = Math.min(minY, y0); maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1); };
    for (const id of Object.keys(pos)) {
      const [px, py] = pos[id], nd = v.nodes[id], nPtrs = (pm[id] || []).length;
      const nPrev = nd && nd.prev !== undefined && String(nd.prev) !== String(nd.v) ? 1 : 0;
      const hasB = v.badges && v.badges[id] !== undefined && v.badges[id] !== null;
      cover(px - R - 14, py - (R + 6 + (nPrev ? 14 : 0) + (nPtrs ? 8 + nPtrs * 13 : 0)), px + R + 14, py + R + (hasB ? 24 : 10));
    }
    if (!Number.isFinite(minX)) cover(0, 0, 140, 80);
    const cls = v.cls || {}, on = new Set((v.on || []).map(String)), id0 = "tr" + uid++, idOn = "tron" + uid++, idCut = "trcut" + uid++;
    const onEdgeSet = new Set((v.onEdges || []).map(([a, b]) => `${a}->${b}`));
    const cutEdges = v.cutEdges || [], cutSet = new Set(cutEdges.map(([a, b]) => `${a}->${b}`));
    let s = `<defs><marker id="${id0}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah"></path></marker><marker id="${idOn}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-on"></path></marker><marker id="${idCut}" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="ah-cut"></path></marker></defs>`;
    let lblSvg = "";
    for (const [f, t, side] of parList) {
      if (cutSet.has(`${f}->${t}`)) continue;
      const p1 = pos[f], p2 = pos[t]; if (!p1 || !p2) continue;
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      const sx = p1[0] + ux * R, sy = p1[1] + uy * R, ex = p2[0] - ux * (v.directed ? R + 3 : R), ey = p2[1] - uy * (v.directed ? R + 3 : R);
      const isOn = (on.has(f) && on.has(t)) || onEdgeSet.has(`${f}->${t}`);
      s += `<line class="edge ${isOn ? "on" : ""}"${v.directed ? ` marker-end="url(#${isOn ? idOn : id0})"` : ""} x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"></line>`;
      if (v.lrLabels) {
        const sgn = side === "L" ? 1 : -1, mx = (sx + ex) / 2 - uy * sgn * 10, my = (sy + ey) / 2 + ux * sgn * 10;
        s += `<text class="lr" x="${mx}" y="${my}">${side}</text>`;
        cover(mx - 10, my - 10, mx + 10, my + 10);
      }
    }
    for (const [a, b] of cutEdges) {
      const p1 = pos[String(a)], p2 = pos[String(b)]; if (!p1 || !p2) continue;
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      const sx = p1[0] + ux * R, sy = p1[1] + uy * R, ex = p2[0] - ux * (v.directed ? R + 3 : R), ey = p2[1] - uy * (v.directed ? R + 3 : R);
      s += `<line class="edge cut"${v.directed ? ` marker-end="url(#${idCut})"` : ""} x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"></line>`;
      s += `<text class="cut-x" x="${(sx + ex) / 2}" y="${(sy + ey) / 2}">×</text>`;
    }
    for (const ex of (v.extra || [])) { const p1 = pos[String(ex.from)], p2 = pos[String(ex.to)]; if (!p1 || !p2) continue;
      const dx = p2[0] - p1[0], dy = p2[1] - p1[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      const sx = p1[0] + ux * R, sy = p1[1] + uy * R, exX = p2[0] - ux * (R + 3), exY = p2[1] - uy * (R + 3), bend = ex.bend ?? 0.35;
      const cx = (sx + exX) / 2 - uy * bend * 64, cy = (sy + exY) / 2 + ux * bend * 64, eCls = ex.cls || "on";
      s += `<path class="edge ${eCls}" marker-end="url(#${eCls.includes("on") ? idOn : id0})" d="M${sx} ${sy} Q${cx} ${cy} ${exX} ${exY}"></path>`;
      const mx = (sx + 2 * cx + exX) / 4, my = (sy + 2 * cy + exY) / 4;
      cover(mx - 18, my - 14, mx + 18, my + 14);
      if (ex.label) {
        const sign = bend >= 0 ? 1 : -1, nx = -uy * sign, ny = ux * sign;
        const tw = [...ex.label].reduce((acc, ch) => acc + (/[\u4e00-\u9fff]/.test(ch) ? 11 : 6.5), 0);
        const pw = Math.ceil(tw + 12), ph = 18;
        const dist = Math.abs(nx) * (pw / 2 * 0.78) + Math.abs(ny) * (ph / 2 + 4) + 6;
        const lx = mx + nx * dist, ly = my + ny * dist;
        lblSvg += `<rect class="edge-bg" x="${lx - pw / 2}" y="${ly - ph / 2}" width="${pw}" height="${ph}" rx="6"></rect>`;
        lblSvg += `<text class="edge-lbl" x="${lx}" y="${ly}">${E(ex.label)}</text>`;
        cover(lx - pw / 2 - 4, ly - ph / 2 - 4, lx + pw / 2 + 4, ly + ph / 2 + 4);
      }
    }
    for (const id of Object.keys(pos)) { const [px, py] = pos[id], nd = v.nodes[id], c = (cls[id] || "").split(" ")[0];
      const nodeHasPrev = nd && nd.prev !== undefined && String(nd.prev) !== String(nd.v);
      s += `<circle class="n ${cls[id] || ""}" cx="${px}" cy="${py}" r="${R}"></circle><text class="${INV.has(c) ? "inv" : c === "d" ? "dimt" : ""}" x="${px}" y="${py}">${show(nd.v)}</text>`;
      if (nodeHasPrev) s += `<text class="tprev" x="${px}" y="${py - (R + 8)}">${show(nd.prev)}→</text>`;
      const b = v.badges && v.badges[id];
      if (b !== undefined && b !== null) { const t = String(b), w = Math.max(26, t.length * 7 + 10);
        s += `<rect class="bd" x="${px - w / 2}" y="${py + 21}" width="${w}" height="16" rx="8"></rect><text class="bt" x="${px}" y="${py + 29}">${E(t)}</text>`; }
      (pm[id] || []).forEach((nm, k) => { s += `<text class="pt" x="${px}" y="${py - (R + 10 + (nodeHasPrev ? 13 : 0) + k * 13)}">${E(nm)}</text>`; });
    }
    const vbW = Math.max(140, Math.round(maxX - minX)), vbH = Math.max(80, Math.round(maxY - minY));
    return `<div class="v">${lab(v)}<div class="scroll"><svg class="g2" viewBox="${Math.round(minX)} ${Math.round(minY)} ${vbW} ${vbH}" style="width:${Math.round(vbW * 1.12)}px;max-width:100%"><g>${s}${lblSvg}</g></svg></div></div>`;
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
  // 多种解法共用同一组输入：mi 是当前解法，cur 是当前输入（切换解法时保留）
  const M = SPEC.methods || [{ t: "", legend: null, build: SPEC.build }];
  let mi = 0, cur = null;
  function run() {
    stop();
    const m = M[mi];
    steps = [];
    m.build(JSON.parse(JSON.stringify(cur.p.args)), (phase, msg, views, o) => steps.push({ phase, msg, views, ...(o || {}) }));
    go(0);
  }
  function setMethod(i) {
    mi = i;
    const m = M[i];
    document.querySelectorAll("#methods button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === String(i))));
    $("mnote").hidden = !m.note; $("mnote").textContent = m.note || "";
    if (m.legend) $("legend").innerHTML = m.legend.map(([c, t]) => `<span><i class="sw ${c}"></i>${E(t)}</span>`).join("");
    if (cur) run();
  }
  // k 是预设的下标；k === -1 表示随机生成一组输入（每点一次换一组）
  function load(k) {
    cur = { k, p: k >= 0 ? SPEC.presets[k] : SPEC.random() };
    document.querySelectorAll("#presets button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === String(k))));
    $("inote").textContent = (k < 0 ? "随机：" : "") + (cur.p.note || "");
    run();
  }
  if ($("methods")) {
    $("methods").innerHTML = M.map((m, i) => `<button type="button" data-m="${i}" aria-pressed="false">${E(m.t)}</button>`).join("");
    document.querySelectorAll("#methods button").forEach((b) => { b.onclick = () => setMethod(Number(b.dataset.m)); });
  }
  setMethod(0);
  $("presets").innerHTML = SPEC.presets.map((p, i) => `<button type="button" id="pre${i}" data-k="${i}" aria-pressed="false">${E(p.label)}</button>`).join("") +
    (SPEC.random ? `<button type="button" id="preR" data-k="-1" aria-pressed="false" title="每点一次换一组随机输入">随机</button>` : "");
  SPEC.presets.forEach((_, i) => { $("pre" + i).onclick = () => load(i); });
  if (SPEC.random) $("preR").onclick = () => load(-1);
  $("reset").onclick = () => { stop(); go(0); };
  $("prev").onclick = () => { stop(); go(idx - 1); };
  $("next").onclick = () => { stop(); go(idx + 1); };
  $("play").onclick = play;
  $("slider").oninput = (e) => { stop(); go(Number(e.target.value)); };
  load(0);
})();
