// Independent keyboard, selection and focus-return checks against the real preview.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const artifacts = process.env.PRACTICE_RETURN_SCREENSHOTS || path.join(os.tmpdir(), "leetcode-editor-return-indent");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, colorScheme: "light", reducedMotion: "no-preference" });
await context.addInitScript(() => { if (window === window.top) localStorage.setItem("hot100:practice:options", JSON.stringify({ mode: "acm", language: "python" })); });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [], results = [];
page.on("pageerror", (error) => errors.push(error.message));
const editor = page.getByRole("textbox", { name: "代码编辑器", exact: true });
const fixture = "class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef merge_sort(nums):\n    if len(nums) <= 1:\n        return nums\n    for index in range(len(nums)):\n        nums[index] = nums[index]\n    return nums\n";

async function viewState() {
  return editor.evaluate((element) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    return { doc: view.state.doc.toString(), selection: view.state.selection.main.toJSON(), top: view.scrollDOM.scrollTop, left: view.scrollDOM.scrollLeft };
  });
}
async function setDocument(value, anchor = value.length, head = anchor) {
  await editor.evaluate((element, { value, anchor, head }) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, selection: { anchor, head } });
    view.scrollDOM.scrollTop = 0; view.scrollDOM.scrollLeft = 0; view.focus();
  }, { value, anchor, head });
  await page.waitForTimeout(35);
}
async function toggleTheme(theme) {
  const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  if ((theme === "dark") !== dark) {
    await page.getByRole("button", { name: theme === "dark" ? /点一下切到深色/ : /点一下切到浅色/ }).click();
    await page.waitForFunction((dark) => document.documentElement.classList.contains("dark") === dark, theme === "dark");
  }
  await page.waitForTimeout(60);
}
async function selectionMetrics() {
  return editor.evaluate((element) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    const rects = [...view.dom.querySelectorAll(".cm-selectionBackground")].map((node) => {
      const r = node.getBoundingClientRect(), s = getComputedStyle(node);
      return { x: r.x, y: r.y, width: r.width, height: r.height, background: s.backgroundColor, radius: s.borderRadius, shadow: s.boxShadow, opacity: s.opacity };
    }).filter((r) => r.width > 0 && r.height > 0);
    return { selection: view.state.selection.main.toJSON(), text: view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to), background: getComputedStyle(view.dom).backgroundColor, rects, active: [...view.dom.querySelectorAll(".cm-activeLine, .cm-activeLineGutter")].map((node) => getComputedStyle(node).backgroundColor) };
  });
}
function assertHighlight(state, label) {
  assert.notEqual(state.selection.anchor, state.selection.head, `${label}: the real selection must be nonempty`);
  assert(state.rects.length, `${label}: CodeMirror must draw selection rectangles`);
  for (const rect of state.rects) {
    assert(rect.background !== state.background && !["transparent", "rgba(0, 0, 0, 0)"].includes(rect.background), `${label}: selection must contrast with the editor`);
    assert(parseFloat(rect.radius) > 0 && rect.shadow !== "none" && Number(rect.opacity) > 0.9, `${label}: selection must have visible rounded, soft shadow styling`);
    const a = rect.background.match(/[\d.]+/g)?.slice(0, 3).map(Number), b = state.background.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (a?.length === 3 && b?.length === 3) assert(Math.hypot(...a.map((n, i) => n - b[i])) > 25, `${label}: selection fill must be visibly different from the editor surface`);
  }
  for (const color of state.active) assert(["transparent", "rgba(0, 0, 0, 0)"].includes(color), `${label}: active-line gray bars must be removed`);
}
async function drag(from, to) {
  const positions = await editor.evaluate((element, { from, to }) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    // Starting a drag inside an existing native selection initiates HTML
    // drag-and-drop. Collapse it first so this action tests text selection.
    view.dispatch({ selection: { anchor: from } });
    const point = (n) => { const r = view.coordsAtPos(n, 1); return { x: r.left + 0.5, y: (r.top + r.bottom) / 2 }; };
    return { a: point(from), b: point(to) };
  }, { from, to });
  await page.waitForTimeout(30);
  await page.mouse.move(positions.a.x, positions.a.y);
  await page.mouse.down(); await page.mouse.move(positions.b.x, positions.b.y, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(50);
  return selectionMetrics();
}
async function selectionChecks(theme) {
  await toggleTheme(theme); await setDocument(fixture, 0);
  const geometry = await editor.evaluate((element) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    return [1, 2, 3, 6].map((number) => {
      const line = view.state.doc.line(number), at = view.domAtPos(line.from), lineElement = (at.node.nodeType === Node.ELEMENT_NODE ? at.node : at.node.parentElement).closest(".cm-line"), style = getComputedStyle(lineElement), origin = view.coordsAtPos(line.from);
      const label = [...view.dom.querySelectorAll(".cm-lineNumbers .cm-gutterElement")].find((n) => n.textContent.trim() === String(number)), text = label && [...label.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
      const textBottom = (node, offset) => { const range = document.createRange(); range.setStart(node, offset); range.setEnd(node, Math.min(offset + 1, node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length)); return range.getBoundingClientRect().bottom; };
      const baseline = text ? textBottom(text, 0) - textBottom(at.node, at.offset) : null;
      return { number, x: origin.left, lineX: lineElement.getBoundingClientRect().x, baseline, lineHeight: parseFloat(style.lineHeight), fourSpaces: number === 3 ? view.coordsAtPos(line.from + 4).left - origin.left : null, depth: Number(lineElement.dataset.indentDepth || 0), positions: style.backgroundPositionX.split(",").map((p) => parseFloat(p)), images: style.backgroundImage };
    });
  });
  assert(Math.abs(geometry[0].x - geometry[3].x) < 1, "Unindented lines must have the same column-zero x");
  for (const line of geometry) {
    assert(Math.abs(line.x - line.lineX) < 1 && Math.abs(line.baseline) < 1, `${theme} line ${line.number}: code/caret/gutter must align`);
  }
  assert.equal(geometry[0].depth, 0); assert.equal(geometry[1].depth, 1); assert.equal(geometry[2].depth, 2);
  assert.notEqual(geometry[2].images, "none");
  assert(Math.abs(geometry[2].positions[1] - geometry[2].fourSpaces) < 1, "Indent guides must follow the rendered width of four spaces");
  for (const [label, from, to] of [["single line", 6, 14], ["multiple lines", 6, fixture.indexOf("self.next") + 8], ["indentation", fixture.indexOf("        self.val"), fixture.indexOf("        self.val") + 7]]) {
    const state = await drag(from, to); assertHighlight(state, `${theme} ${label}`);
    assert.equal((await viewState()).doc, fixture, `${theme} ${label}: selection dragging must leave the document unchanged`);
    if (label === "multiple lines") await page.locator(".practice-editor").screenshot({ path: path.join(artifacts, `${theme}-mouse-selection.png`) });
  }
  await setDocument(fixture, 6); await page.keyboard.press("Shift+ArrowRight"); await page.keyboard.press("Shift+ArrowRight");
  await page.waitForTimeout(40); const keyboard = await selectionMetrics(); assertHighlight(keyboard, `${theme} keyboard Shift`);
  const selected = (await viewState()).selection;
  await page.locator('.practice-editor-toolbar button[aria-label="练习语言"]').focus();
  await page.waitForTimeout(40); assertHighlight(await selectionMetrics(), `${theme} blurred`);
  await editor.focus(); assert.deepEqual((await viewState()).selection, selected);
  assert.equal((await viewState()).doc, fixture, `${theme}: dragging and focus never modify source`);
  results.push({ theme, selection: keyboard.rects[0], geometry });
}
async function pythonKeyboard() {
  for (const header of ["class ListNode:", "def solve():", "if True:", "for item in []:"]) {
    await setDocument(""); await page.keyboard.insertText(header); await page.keyboard.press("Enter");
    assert.equal((await viewState()).doc, `${header}\n    `, `${header}: real Enter must indent four spaces`);
  }
  await setDocument("");
  for (const header of ["class ListNode:", "def solve(self):", "if True:"]) { await page.keyboard.insertText(header); await page.keyboard.press("Enter"); }
  assert.equal((await viewState()).doc, "class ListNode:\n    def solve(self):\n        if True:\n            ", "Nested Enter must produce 4/8/12 spaces");
  // Escape deliberately enables CodeMirror's accessible Tab-out mode for two
  // seconds. A normal navigation key ends that mode before testing indentation.
  await page.keyboard.press("Escape"); await page.keyboard.press("ArrowLeft"); await setDocument("");
  await page.keyboard.press("Tab"); assert.equal((await viewState()).doc, "    ", "Tab without completion inserts four spaces");
  await page.keyboard.press("Shift+Tab"); assert.equal((await viewState()).doc, "", "Shift+Tab removes four spaces");
  await setDocument("        value = 1", 8); await page.keyboard.press("Shift+Tab");
  assert.equal((await viewState()).doc, "    value = 1", "Shift+Tab removes one indentation level");
  await page.keyboard.press("Tab"); assert.equal((await viewState()).doc, "        value = 1", "Tab restores one indentation level");
  await setDocument("li"); await page.keyboard.press("ControlOrMeta+Space");
  const popup = page.locator(".cm-tooltip-autocomplete"); await popup.waitFor();
  await popup.locator('li[aria-selected="true"] .cm-completionLabel').waitFor();
  await page.waitForTimeout(100); await page.keyboard.press("ArrowDown");
  const completion = await popup.locator('li[aria-selected="true"] .cm-completionLabel').innerText();
  await page.keyboard.press("Tab"); await popup.waitFor({ state: "hidden" });
  assert.equal((await viewState()).doc, completion, "Tab still accepts the selected completion");
  console.log("✓ Python real Enter: class/def/if/for and nested 4/8/12; Tab/Shift+Tab four spaces; completion Tab still accepts.");
}
async function traceFocusTransition(button, stablePhase, label) {
  await page.evaluate(() => {
    window.__focusSyncFrames = []; const token = {}; window.__focusSyncToken = token;
    const animationIds = new WeakMap(); let nextId = 1;
    const sample = (rafTime) => {
      if (window.__focusSyncToken !== token) return;
      const old = window.__returnRefs, content = document.querySelector(".cm-content"), view = content?.cmTile?.root?.view || content?.cmView?.view;
      const shell = document.querySelector(".practice-sidebar"), column = document.querySelector(".practice-editor-column"), statement = document.querySelector(".practice-focus-statement"), originalRegion = document.querySelector(".problem-original"), original = originalRegion?.querySelector("#statement")?.closest("section")?.querySelector(".card");
      const animations = document.getAnimations().filter((a) => { const timing = a.effect?.getComputedTiming(), target = a.effect?.target; return target instanceof Element && (shell.contains(target) || target === original || target === originalRegion) && Number.isFinite(timing?.endTime) && Number(timing?.duration) > 0; });
      const state = (element, includeChildren = false) => {
        const r = element.getBoundingClientRect(), s = getComputedStyle(element); let opacity = 1;
        let displayed = s.display !== "none" && s.visibility === "visible";
        for (let node = element; node; node = node.parentElement) { const style = getComputedStyle(node); opacity *= Number(style.opacity); if (style.display === "none") displayed = false; }
        const visibleArea = Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left)) * Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
        return { x: r.x, y: r.y, width: r.width, height: r.height, opacity, renderedOpacity: displayed && visibleArea > 1 ? opacity : 0, visibleArea, display: s.display, visibility: s.visibility, background: s.backgroundColor, overflow: s.overflow, animations: animations.filter((a) => a.effect.target === element || a.effect.target.contains(element) || (includeChildren && element.contains(a.effect.target))).map((a) => {
          if (!animationIds.has(a)) animationIds.set(a, nextId++);
          const timing = a.effect.getTiming(), computed = a.effect.getComputedTiming();
          // CSS animations keep their easing on the keyframe, whereas WAAPI
          // animations in this component set it on the effect itself.
          const easing = timing.easing !== "linear" ? timing.easing : a.effect.getKeyframes()[0]?.easing || "linear";
          return { id: animationIds.get(a), target: a.effect.target.className, startTime: Number(a.startTime), currentTime: Number(a.currentTime), duration: Number(computed.duration), easing, progress: computed.progress, playState: a.playState };
        }) };
      };
      window.__focusSyncFrames.push({ time: performance.now(), rafTime, phase: shell.dataset.focusPhase, editor: state(column), cm: state(view.dom), statement: state(statement), focusHeading: state(statement.querySelector(".practice-focus-statement-heading")), original: state(original), originalRegion: state(originalRegion), originalHeading: state(originalRegion.querySelector("h1")), originalSection: state(originalRegion.querySelector("#statement")), sidebar: state(shell), same: content === old.content && view === old.view && view.dom === old.editor, doc: view.state.doc.toString() === old.doc, selection: JSON.stringify(view.state.selection.main.toJSON()) === JSON.stringify(old.selection), lines: content.querySelectorAll(".cm-line").length, top: view.scrollDOM.scrollTop, left: view.scrollDOM.scrollLeft, locked: document.body.style.overflow === "hidden" });
      requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  await button.click();
  await page.waitForFunction((phase) => document.querySelector(".practice-sidebar")?.dataset.focusPhase === phase, stablePhase);
  await page.waitForFunction(() => !document.querySelector(".practice-sidebar").getAnimations().some((a) => Number.isFinite(a.effect?.getComputedTiming().endTime) && a.playState === "running"));
  await page.waitForTimeout(60);
  const frames = await page.evaluate(() => { window.__focusSyncToken = null; return window.__focusSyncFrames; });
  await fs.writeFile(path.join(artifacts, `focus-${label}-frames.json`), JSON.stringify(frames, null, 2));
  const running = (frame, key) => frame[key].animations.filter((a) => a.playState === "running" && a.duration >= 80);
  const editorMotion = frames.filter((frame) => running(frame, "editor").length), statementMotion = frames.filter((frame) => running(frame, "statement").length);
  assert(editorMotion.length && statementMotion.length, `${label}: sample real motion on both code and statement`);
  const firstEditor = editorMotion[0], firstStatement = statementMotion[0], lastEditor = editorMotion.at(-1), lastStatement = statementMotion.at(-1);
  // These are measured browser frames, independent of internal React phases.
  assert(Math.abs(firstEditor.time - firstStatement.time) < 35, `${label}: both regions must begin within one frame`);
  assert(Math.abs(lastEditor.time - lastStatement.time) < 35, `${label}: both regions must complete within one frame`);
  const actors = [...new Map([...editorMotion.flatMap((f) => running(f, "editor")), ...statementMotion.flatMap((f) => running(f, "statement")), ...(label === "return" ? frames.flatMap((f) => running(f, "original")) : [])].map((a) => [a.id, a])).values()];
  const reference = actors[0];
  assert.equal(reference.duration, label === "enter" ? 240 : 60, `${label}: use the intended duration`);
  assert.equal(reference.easing, label === "enter" ? "cubic-bezier(0.2, 0.8, 0.2, 1)" : "linear", `${label}: use the intended entry or immediate exit easing`);
  for (const animation of actors) {
    assert(Math.abs(animation.startTime - reference.startTime) < 2, `${label}: shared browser timeline startTime`);
    assert.equal(animation.duration, reference.duration, `${label}: shared duration`);
    assert.equal(animation.easing, reference.easing, `${label}: shared easing`);
  }
  for (const frame of frames) {
    assert(frame.same && frame.doc && frame.selection, `${label}/${frame.phase}: preserve CM DOM/view/document/selection`);
    assert(frame.cm.width > 100 && frame.cm.height > 100 && frame.lines > 0, `${label}/${frame.phase}: code remains populated`);
    if (running(frame, "editor").length) {
      assert(Math.abs(frame.editor.opacity - frame.statement.opacity) < 0.01, `${label}: both regions fade together through their common parent`);
      assert.deepEqual(running(frame, "editor").map((a) => a.id), running(frame, "statement").map((a) => a.id), `${label}: both regions use the same parent animation`);
    }
    if (frame.phase === "closed") assert(frame.editor.opacity > 0.99 && frame.cm.opacity > 0.99, "Normal editor is fully visible after the parent animation ends");
    if (running(frame, "editor").length || running(frame, "statement").length) assert(frame.locked, `${label}: retain body lock until both regions finish`);
    if (label === "return") {
      const source = Math.max(frame.original.renderedOpacity, frame.originalHeading.renderedOpacity, frame.originalSection.renderedOpacity);
      assert(!(frame.statement.renderedOpacity > 0.005 && source > 0.005), `Return frame ${frame.time}: source body/title/section and floating statement must never be visible together (${source}, ${frame.statement.renderedOpacity})`);
      if (frame.phase !== "closed") assert.equal(frame.originalRegion.visibility, "hidden", "The entire original title, section headings and body stay hidden throughout focus exit");
    }
  }
  return { frames, timeline: { duration: reference.duration, easing: reference.easing, startDifference: Math.max(...actors.map((a) => a.startTime)) - Math.min(...actors.map((a) => a.startTime)), firstFrameDifference: Math.abs(firstEditor.time - firstStatement.time), lastFrameDifference: Math.abs(lastEditor.time - lastStatement.time), doubleStatementFrames: frames.filter((f) => f.statement.renderedOpacity > 0.005 && Math.max(f.original.renderedOpacity, f.originalHeading.renderedOpacity, f.originalSection.renderedOpacity) > 0.005).length } };
}
async function focusReturn() {
  // A small full program creates a real result node without an algorithm run.
  await page.locator('.practice-editor-toolbar button[aria-label="练习语言"]').click();
  await page.getByRole("option", { name: "JavaScript", exact: true }).click();
  await setDocument("console.log('report-seed');");
  await page.getByRole("button", { name: "运行示例", exact: true }).click();
  await page.getByTestId("practice-test-panel").waitFor();
  await page.getByText("有用例未通过", { exact: true }).waitFor();
  const raw = "  // keep two spaces and trailing spaces  \n\t// keep this tab\n" + Array.from({ length: 100 }, (_, i) => `const value_${i} = '${"x".repeat(i === 45 ? 180 : 14)}';`).join("\n");
  await setDocument(raw, 0); await page.waitForTimeout(650);
  await page.keyboard.insertText("// undo marker\n"); const modified = (await viewState()).doc;
  await page.keyboard.press("ControlOrMeta+Z"); assert.equal((await viewState()).doc, raw);
  await page.keyboard.press("Control+y"); assert.equal((await viewState()).doc, modified);
  await editor.evaluate((element) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    const from = view.state.doc.line(20).from;
    view.dispatch({ selection: { anchor: from + 6, head: from + 13 } });
    view.scrollDOM.scrollTop = 300; view.scrollDOM.scrollLeft = 40;
    const original = document.querySelector(".problem-original #statement")?.closest("section")?.querySelector(".card");
    window.__returnRefs = { content: element, view, editor: view.dom, report: document.querySelector('#practice [aria-live="polite"]'), doc: view.state.doc.toString(), selection: view.state.selection.main.toJSON(), overflow: document.body.style.overflow, pageY: window.scrollY, originalVisibility: original?.style.visibility };
  });
  await page.waitForTimeout(70);
  const before = await viewState();
  assert(await page.evaluate(() => !!document.querySelector(".problem-original #statement")?.closest("section")?.querySelector(".card")), "Return-to-statement card selector must resolve the actual original card");
  const entering = await traceFocusTransition(page.getByRole("button", { name: "进入专注模式", exact: true }), "open", "enter");
  await page.screenshot({ path: path.join(artifacts, "synchronized-focus-open.png") });
  const returning = await traceFocusTransition(page.getByRole("button", { name: "退出专注模式", exact: true }), "closed", "return");
  assert.equal(entering.timeline.duration, 240); assert.equal(returning.timeline.duration, 60);
  await page.waitForFunction(() => document.body.style.overflow !== "hidden");
  const after = await viewState();
  const sampled = await page.evaluate(() => {
    const old = window.__returnRefs;
    const original = document.querySelector(".problem-original #statement")?.closest("section")?.querySelector(".card");
    return { sameReport: document.querySelector('#practice [aria-live="polite"]') === old.report, overflow: document.body.style.overflow, expectedOverflow: old.overflow, pageY: window.scrollY, expectedPageY: old.pageY, originalVisibility: original.style.visibility, expectedOriginalVisibility: old.originalVisibility, originalComputedVisibility: getComputedStyle(original).visibility, originalOpacity: getComputedStyle(original).opacity };
  });
  const frames = returning.frames;
  assert.equal(after.doc, modified); assert.deepEqual(after.selection, before.selection);
  assert(Math.abs(after.top - before.top) <= 1 && Math.abs(after.left - before.left) <= 1, `Editor scroll must survive: ${before.top},${before.left} -> ${after.top},${after.left}`);
  assert(sampled.sameReport, "Results DOM must survive focus return"); assert.equal(sampled.overflow, sampled.expectedOverflow);
  assert.equal(sampled.originalVisibility, sampled.expectedOriginalVisibility, "Original statement inline visibility is restored exactly");
  assert.equal(sampled.originalComputedVisibility, "visible"); assert.equal(sampled.originalOpacity, "1", "No hidden or faded source statement remains after return");
  assert(Math.abs(sampled.pageY - sampled.expectedPageY) < 1, "Page scroll must survive focus return");
  await editor.focus(); await page.keyboard.press("ControlOrMeta+Z"); assert.equal((await viewState()).doc, raw, "Undo history survives focus return");
  await page.keyboard.press("Control+y"); assert.equal((await viewState()).doc, modified, "Redo history survives focus return");
  assert.equal(await editor.evaluate((element) => getComputedStyle((element.cmTile?.root?.view || element.cmView?.view).dom).backgroundColor), "rgb(255, 255, 255)", "Light editor canvas is white");
  results.push({ enterFrames: entering.frames.length, returnFrames: frames.length, entering: entering.timeline, returning: returning.timeline, minimumReturnOpacity: Math.min(...frames.map((frame) => frame.editor.opacity)), scrollBefore: { top: before.top, left: before.left }, scrollAfter: { top: after.top, left: after.left } });
  console.log("✓ Both focus regions share one parent fade/scale; no duplicated source text; same CM/view/doc/selection/results/undo, white editor and conserved scroll.");
}

async function statementHandoffScreenshots() {
  // A separate visual pass pauses the real common-parent exit animation.
  // The main pass above samples the unmodified running timeline.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".practice-sidebar")?.dataset.focusPhase === "open");
  await page.locator(".practice-sidebar").evaluate(async (e) => { await Promise.all(e.getAnimations().map((a) => a.finished.catch(() => {}))); });
  await page.screenshot({ path: path.join(artifacts, "statement-handoff-start.png"), clip: { x: 0, y: 0, width: 930, height: 1080 } });
  await page.getByRole("button", { name: "退出专注模式", exact: true }).click();
  await page.evaluate(() => {
    const animations = document.querySelector(".practice-sidebar").getAnimations().filter((a) => a.playState === "running" && Number.isFinite(a.effect?.getComputedTiming().endTime));
    if (animations.length !== 1) throw Error("Expected one common-parent exit animation");
    animations[0].pause(); window.__handoffPaused = animations;
  });
  await page.evaluate(() => window.__handoffPaused.forEach((a) => { a.currentTime = 30; }));
  assert.equal(await page.locator(".problem-original").evaluate((element) => getComputedStyle(element).visibility), "hidden", "Original title, headings and body remain hidden during the parent fade");
  await page.screenshot({ path: path.join(artifacts, "statement-handoff-middle.png"), clip: { x: 0, y: 0, width: 930, height: 1080 } });
  await page.evaluate(() => window.__handoffPaused.forEach((a) => { a.currentTime = 59; a.play(); }));
  await page.waitForFunction(() => document.querySelector(".practice-sidebar")?.dataset.focusPhase === "closed" && document.body.style.overflow !== "hidden");
  assert.equal(await page.locator(".problem-original").evaluate((element) => getComputedStyle(element).visibility), "visible");
  await page.screenshot({ path: path.join(artifacts, "statement-handoff-end.png"), clip: { x: 0, y: 0, width: 930, height: 1080 } });
  console.log("✓ One common-parent exit animation; enlarged start/middle/end screenshots include the full original title/section/body area with no duplicate text.");
}

async function reducedMotionReturn() {
  const reduced = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: "reduce" }), p = await reduced.newPage();
  p.on("pageerror", (error) => errors.push(error.message));
  await p.goto(`${base}/p/15/`); await p.getByRole("textbox", { name: "代码编辑器", exact: true }).waitFor();
  await p.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await p.waitForFunction(() => document.querySelector(".practice-sidebar")?.dataset.focusPhase === "open");
  const start = Date.now(); await p.getByRole("button", { name: "退出专注模式", exact: true }).click();
  await p.waitForFunction(() => document.querySelector(".practice-sidebar")?.dataset.focusPhase === "closed" && document.body.style.overflow !== "hidden");
  assert(Date.now() - start < 1000, "Reduced-motion return completes without the animated hand-off delay");
  await reduced.close(); console.log("✓ Reduced-motion return releases scroll lock promptly.");
}

async function narrowFocusReturn() {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" }), p = await mobile.newPage();
  p.on("pageerror", (error) => errors.push(error.message));
  await p.goto(`${base}/p/15/`); const code = p.getByRole("textbox", { name: "代码编辑器", exact: true }); await code.waitFor();
  await p.waitForFunction(() => document.querySelector(".cm-content")?.getAttribute("contenteditable") === "true");
  await code.evaluate((element) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    const source = Array.from({ length: 60 }, (_, i) => `value_${i} = ${i}`).join("\n");
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source }, selection: { anchor: 3, head: 7 } });
    window.__mobileFocusRefs = { element, view, source, selection: view.state.selection.main.toJSON() };
  });
  await p.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await p.waitForFunction(() => document.querySelector(".practice-sidebar")?.dataset.focusPhase === "open");
  await p.locator(".practice-sidebar").evaluate(async (e) => { await Promise.all(e.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime)).map((a) => a.finished.catch(() => {}))); });
  const layout = await p.evaluate(() => {
    const a = document.querySelector(".practice-focus-statement").getBoundingClientRect(), b = document.querySelector(".practice-editor-column").getBoundingClientRect();
    return { stacked: b.y >= a.bottom - 1, inViewport: a.left >= 0 && b.left >= 0 && a.right <= innerWidth && b.right <= innerWidth };
  });
  assert(layout.stacked && layout.inViewport, "Narrow focus keeps statement above code, within the viewport");
  await p.evaluate(() => {
    window.__mobileFrames = []; window.__mobileSampling = true;
    const sample = () => {
      if (!window.__mobileSampling) return;
      const phase = document.querySelector(".practice-sidebar").dataset.focusPhase, statement = document.querySelector(".practice-focus-statement"), style = getComputedStyle(statement), r = statement.getBoundingClientRect();
      const originalRegion = document.querySelector(".problem-original"), original = originalRegion.querySelector("#statement").closest("section").querySelector(".card");
      const alpha = (node) => { const style = getComputedStyle(node), r = node.getBoundingClientRect(); if (style.visibility !== "visible" || style.display === "none" || r.bottom < 0 || r.top > innerHeight) return 0; let value = 1; for (let n = node; n; n = n.parentElement) value *= Number(getComputedStyle(n).opacity); return value; };
      window.__mobileFrames.push({ phase, display: style.display, shellPosition: getComputedStyle(document.querySelector(".practice-sidebar")).position, width: r.width, height: r.height, locked: document.body.style.overflow === "hidden", sourceVisibility: getComputedStyle(originalRegion).visibility, sourceOpacity: Math.max(alpha(original), alpha(originalRegion.querySelector("h1")), alpha(originalRegion.querySelector("#statement"))), copyOpacity: alpha(statement) });
      requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  await p.getByRole("button", { name: "退出专注模式", exact: true }).click();
  await p.waitForFunction(() => document.querySelector(".practice-sidebar")?.dataset.focusPhase === "closed" && document.body.style.overflow !== "hidden");
  const state = await p.evaluate(() => {
    window.__mobileSampling = false;
    const old = window.__mobileFocusRefs, element = document.querySelector(".cm-content"), view = element.cmTile?.root?.view || element.cmView?.view;
    const original = document.querySelector(".problem-original #statement")?.closest("section")?.querySelector(".card");
    return { frames: window.__mobileFrames, same: element === old.element && view === old.view && view.state.doc.toString() === old.source && JSON.stringify(view.state.selection.main.toJSON()) === JSON.stringify(old.selection), horizontalOverflow: document.documentElement.scrollWidth - innerWidth, original: !!original, originalVisibility: getComputedStyle(original).visibility, originalOpacity: getComputedStyle(original).opacity };
  });
  const moving = state.frames.filter((f) => f.phase !== "open" && f.phase !== "closed");
  assert(moving.length, "Narrow layout still performs a real return animation");
  assert(moving.every((f) => f.display !== "none" && f.shellPosition === "fixed" && f.width > 100 && f.height > 100 && f.locked && f.sourceVisibility === "hidden"), "Narrow exit keeps both panels in the same fixed shell, hides original text and retains body lock until completion");
  assert(state.frames.every((f) => !(f.sourceOpacity > 0.005 && f.copyOpacity > 0.005)), "Narrow exit must not show both statements together");
  assert(state.same && state.original && state.horizontalOverflow < 2, "Narrow return retains the editor, original statement and normal page width");
  assert.equal(state.originalVisibility, "visible"); assert.equal(state.originalOpacity, "1");
  await fs.writeFile(path.join(artifacts, "focus-mobile-frames.json"), JSON.stringify(state.frames, null, 2));
  await mobile.close(); console.log("✓ 390px parent exit retains stacked layout, body lock, original-text exclusion and same editor.");
}

async function latencyOnly() {
  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".practice-sidebar")?.dataset.focusPhase === "open");
  const opening = await page.locator(".practice-sidebar").evaluate(async (shell) => {
    const style = getComputedStyle(shell), timing = { duration: style.animationDuration, easing: style.animationTimingFunction };
    await Promise.all(shell.getAnimations().map((a) => a.finished.catch(() => {}))); return timing;
  });
  assert.equal(opening.duration, "0.24s"); assert.equal(opening.easing, "cubic-bezier(0.2, 0.8, 0.2, 1)");
  await page.getByRole("button", { name: "退出专注模式", exact: true }).evaluate((button) => {
    const shell = document.querySelector(".practice-sidebar"), original = document.querySelector(".problem-original"), statement = document.querySelector(".practice-focus-statement");
    window.__exitLatency = { frames: [], done: false };
    button.addEventListener("pointerup", () => { window.__exitLatency.inputTime = performance.now(); }, { capture: true, once: true });
    button.addEventListener("click", () => { window.__exitLatency.clickTime = performance.now(); }, { capture: true, once: true });
    shell.addEventListener("animationstart", (event) => { if (event.target === shell) window.__exitLatency.animationStartTime = performance.now(); }, { capture: true });
    shell.addEventListener("animationend", (event) => { if (event.target === shell) window.__exitLatency.animationEndTime = performance.now(); }, { capture: true });
    const observer = new MutationObserver(() => {
      const record = window.__exitLatency;
      if (record.inputTime !== undefined && shell.dataset.focusPhase === "closed") {
        record.closedCommitTime = performance.now();
        record.closedVisibility = getComputedStyle(original).visibility;
        record.closedCopyVisible = !statement.hidden;
        record.done = true; observer.disconnect();
      }
    });
    observer.observe(shell, { attributes: true, attributeFilter: ["data-focus-phase"] });
    const sample = (rafTime) => {
      const record = window.__exitLatency; if (record.done) return;
      const style = getComputedStyle(shell), sourceVisibility = getComputedStyle(original).visibility;
      const frame = { time: performance.now(), rafTime, phase: shell.dataset.focusPhase, opacity: Number(style.opacity), transform: style.transform, sourceVisibility, copyVisible: !statement.hidden };
      record.frames.push(frame);
      if (frame.phase === "closing" && !record.timing) record.timing = { duration: style.animationDuration, easing: style.animationTimingFunction };
      requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  });
  await page.getByRole("button", { name: "退出专注模式", exact: true }).click();
  await page.waitForFunction(() => window.__exitLatency?.done);
  const data = await page.evaluate(() => window.__exitLatency);
  await fs.writeFile(path.join(artifacts, "latency-frames.json"), JSON.stringify(data, null, 2));
  assert.equal(data.timing.duration, "0.06s"); assert.equal(data.timing.easing, "linear");
  const closing = data.frames.filter((f) => f.phase === "closing"), changed = closing.find((f) => f.opacity < 0.995), closed = { time: data.closedCommitTime, sourceVisibility: data.closedVisibility, copyVisible: data.closedCopyVisible };
  assert(data.inputTime !== undefined && changed && closed, "Record real pointer input, opacity change and closed restore");
  const firstClosing = closing[0], inputToChange = changed.time - data.inputTime, inputToClosed = closed.time - data.inputTime;
  const intervals = data.frames.slice(1).map((f, i) => f.rafTime - data.frames[i].rafTime).filter((n) => n > 0 && n < 100).sort((a,b) => a-b), rafInterval = intervals[Math.floor(intervals.length / 2)];
  // Headless Chrome may report a high-refresh RAF interval (~6ms), and a
  // callback can carry a timestamp from before the pointer event. Use real
  // event/MutationObserver times instead of treating that interval as latency.
  assert(inputToChange < 35, `Exit starts promptly after pointerup: ${inputToChange}ms`);
  // CSS duration stays exact. DOM restoration additionally includes synchronous
  // React/layout work; record that cost rather than imposing a device-specific
  // exact-duration target on the complete interaction.
  assert(inputToClosed < 150, `60ms exit and DOM restoration complete within the interaction budget: ${inputToClosed}ms`);
  assert(data.frames.every((f) => !(f.copyVisible && f.opacity > 0.005 && f.sourceVisibility === "visible")), "No doubled title, section headings or body");
  assert.equal(closed.sourceVisibility, "visible"); assert.equal(closed.copyVisible, false);
  const canvas = await page.locator(".cm-editor").evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.equal(canvas, "rgb(255, 255, 255)");
  for (const url of ["/p/15/", "/practice/0015.json"]) assert.equal((await page.request.get(`${base}${url}`)).status(), 200);
  assert.deepEqual(errors, []);
  results.push({ opening, exit: data.timing, inputToFirstChangeMilliseconds: inputToChange, inputToAnimationEndMilliseconds: data.animationEndTime - data.inputTime, animationEndToClosedCommitMilliseconds: data.closedCommitTime - data.animationEndTime, inputToClosedMilliseconds: inputToClosed, firstChangeAfterClosingRafMilliseconds: changed.rafTime - firstClosing.rafTime, measuredRafIntervalMilliseconds: rafInterval, firstChangedOpacity: changed.opacity, doubleStatementFrames: 0, canvas, healthyPageAndProblemData: true });
  await fs.writeFile(path.join(artifacts, "latency-frames.json"), JSON.stringify(data, null, 2));
  console.log("✓ Real pointer input starts a 60ms linear exit promptly; one parent, no doubled statement, restored page and white editor.");
}

try {
  await fs.mkdir(artifacts, { recursive: true });
  assert.equal((await page.request.get(`${base}/api/problem/15`)).status(), 200);
  await page.goto(`${base}/p/15/`); await editor.waitFor();
  await page.waitForFunction(() => document.querySelector(".cm-content")?.getAttribute("contenteditable") === "true");
  if (process.argv.includes("--latency-only") || process.argv.includes("--fade-only")) {
    await latencyOnly();
    await fs.writeFile(path.join(artifacts, "latency-report.json"), JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ results, artifacts }, null, 2));
  } else if (process.argv.includes("--baseline")) {
    await setDocument(fixture, 0); const state = await drag(6, 14);
    console.log(JSON.stringify({ baselineOnly: true, ...state }, null, 2));
    await page.locator(".practice-editor").screenshot({ path: path.join(artifacts, "baseline-selection.png") });
  } else {
    if (!process.argv.includes("--focus-only")) {
      if (!process.argv.includes("--selection-only")) await pythonKeyboard();
      await selectionChecks("light");
      const beforeTheme = await viewState(); await toggleTheme("dark");
      assert.deepEqual((await viewState()).selection, beforeTheme.selection, "Theme change must preserve the selected range");
      assert.equal((await viewState()).doc, beforeTheme.doc); assertHighlight(await selectionMetrics(), "theme changed while selected");
      await selectionChecks("dark"); await toggleTheme("light");
      console.log("✓ Real mouse single-line/multiline/indent selection, keyboard Shift, blur/refocus/theme preservation, rounded highlight in both themes; active line stays transparent.");
    }
    if (!process.argv.includes("--selection-only")) { await focusReturn(); await statementHandoffScreenshots(); await reducedMotionReturn(); await narrowFocusReturn(); }
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(artifacts, "report.json"), JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ results, artifacts }, null, 2));
  }
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
