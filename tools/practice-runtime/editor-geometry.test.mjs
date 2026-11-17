// Independent editor geometry + completion checks, without executing algorithms.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const screenshots = process.env.PRACTICE_EDITOR_SCREENSHOTS || path.join(os.tmpdir(), "leetcode-editor-geometry");
const sample = "n = int(input())\n\nnums = list(map(int, input().split()))\n\ndp = [1] * n\n\nfor i in range(n):\n    for j in range(i):\n        if nums[i] > nums[j]:\n            dp[i] = max(dp[i], dp[j] + 1)\n\nprint(max(dp))";
const extra = Array.from({ length: 110 }, (_, i) => i === 47 ? `wide_name = "${"x".repeat(200)}"` : `value_${i} = ${i}`);
const source = sample + "\n" + extra.join("\n");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, colorScheme: "light" });
await context.addInitScript(() => { if (window === window.top) localStorage.setItem("hot100:practice:options", JSON.stringify({ mode: "acm", language: "python" })); });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [], measurements = [];
page.on("pageerror", (error) => errors.push(error.message));

async function setDocument(value, anchor = 0, head = anchor) {
  await page.evaluate(({ value, anchor, head }) => {
    const content = document.querySelector(".cm-content"), view = content?.cmTile?.root?.view || content?.cmView?.view;
    if (!view) throw Error("CodeMirror view is not available");
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, selection: { anchor, head } });
    view.scrollDOM.scrollTop = 0; view.scrollDOM.scrollLeft = 0;
    view.focus();
  }, { value, anchor, head });
}
async function metrics(lineNumbers) {
  return page.evaluate((numbers) => {
    const content = document.querySelector(".cm-content"), view = content?.cmTile?.root?.view || content?.cmView?.view;
    const gutter = document.querySelector(".cm-gutters"), editor = document.querySelector(".cm-editor");
    const textRect = (node, start = 0, end) => { const range = document.createRange(); range.setStart(node, start); range.setEnd(node, end ?? node.textContent.length); return range.getBoundingClientRect(); };
    return {
      doc: view.state.doc.toString(),
      background: getComputedStyle(editor).backgroundColor,
      gutterX: gutter.getBoundingClientRect().x,
      scrollLeft: view.scrollDOM.scrollLeft,
      lines: numbers.map((number) => {
        const line = view.state.doc.line(number), position = view.domAtPos(line.from, 1), coords = view.coordsAtPos(line.from, 1);
        const element = (position.node.nodeType === Node.ELEMENT_NODE ? position.node : position.node.parentElement).closest(".cm-line");
        const text = textRect(position.node, position.offset, Math.min(position.offset + 1, position.node.nodeType === Node.TEXT_NODE ? position.node.length : position.node.childNodes.length));
        const label = [...document.querySelectorAll(".cm-lineNumbers .cm-gutterElement")].find((e) => e.textContent.trim() === String(number) && e.getBoundingClientRect().height > 0);
        const labelText = label && [...label.childNodes].find((n) => n.nodeType === Node.TEXT_NODE);
        const labelRect = labelText ? textRect(labelText) : null;
        return { number, text: line.text, origin: coords?.left, nativeOrigin: text.left, lineLeft: element.getBoundingClientRect().left, paddingLeft: parseFloat(getComputedStyle(element).paddingLeft), lineHeight: parseFloat(getComputedStyle(element).lineHeight), baselineDelta: labelRect ? labelRect.bottom - text.bottom : null };
      }),
    };
  }, lineNumbers);
}
function assertGeometry(state, label) {
  assert.equal(state.doc, source, `${label}: styling must never trim or change source text`);
  const origin = state.lines[0].origin;
  for (const line of state.lines) {
    assert(!/^\s/.test(line.text), "Only unindented lines are used for column-zero checks");
    assert(Math.abs(line.origin - origin) < 0.8, `${label}: unindented line ${line.number} starts at another x`);
    assert(Math.abs(line.origin - line.nativeOrigin) < 0.8, `${label}: cursor/native text start mismatch on line ${line.number}`);
    assert(Math.abs(line.origin - line.lineLeft) < 0.8, `${label}: active-line left edge must start at column zero, without a character-sized inset`);
    assert.notEqual(line.baselineDelta, null, `${label}: line ${line.number} needs a visible line number`);
    assert(Math.abs(line.baselineDelta) <= 1, `${label}: line-number baseline drifts on line ${line.number} by ${line.baselineDelta}px`);
  }
  measurements.push({ label, background: state.background, origin, lineHeight: state.lines[0].lineHeight, maxBaselineDelta: Math.max(...state.lines.map((line) => Math.abs(line.baselineDelta))) });
}
async function openCompletion() {
  await setDocument("li", 2);
  await page.keyboard.press("ControlOrMeta+Space");
  const popup = page.locator(".cm-tooltip-autocomplete");
  await popup.waitFor();
  await popup.locator('li[aria-selected="true"] .cm-completionLabel').waitFor();
  // The installed autocomplete package intentionally ignores navigation/accept
  // keys for its first 75ms (completionConfig.interactionDelay).
  await page.waitForTimeout(100);
  const bounds = await popup.boundingBox(), column = await page.locator(".practice-editor-column").boundingBox();
  assert(bounds && column && bounds.x >= column.x - 2 && bounds.x + bounds.width <= column.x + column.width + 2, "Completion popup must fit the code column");
  const visible = await popup.locator('li[role="option"]').first().evaluate((element) => { const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + Math.min(40, r.width / 2), r.y + r.height / 2); return element === hit || element.contains(hit); });
  assert(visible, "Completion options must not be covered by an overlay");
  return popup;
}
async function completionKeys(theme) {
  for (const key of ["Enter", "Tab"]) {
    const popup = await openCompletion();
    assert(await popup.locator('li[role="option"]').count() >= 2);
    await page.keyboard.press("ArrowDown");
    const selected = await popup.locator('li[aria-selected="true"] .cm-completionLabel').innerText();
    await page.keyboard.press(key);
    await popup.waitFor({ state: "hidden" });
    const actual = await page.locator(".cm-content").evaluate((element) => (element.cmTile?.root?.view || element.cmView?.view).state.doc.toString());
    assert(actual.startsWith(selected), `${theme}: ${key} must accept the selected completion, not insert indentation`);
  }
  await openCompletion();
  await page.keyboard.press("Escape");
  await page.locator(".cm-tooltip-autocomplete").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".cm-content").innerText(), "li", `${theme}: Escape closes suggestions without changing the text`);
  console.log(`✓ ${theme}: completion bounds, visibility, ArrowDown/Enter/Tab and Escape`);
}
async function focusOpen() {
  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".practice-sidebar")?.getAttribute("data-focus-phase") === "open");
  await page.locator(".practice-sidebar").evaluate(async (element) => { await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {}))); });
}
async function focusClose() {
  await page.getByRole("button", { name: "退出专注模式", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".practice-sidebar")?.getAttribute("data-focus-phase") === "closed");
  await page.waitForFunction(() => document.body.style.overflow !== "hidden");
}
async function lastLineReachable(label) {
  await page.locator(".cm-content").evaluate((element) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    view.scrollDOM.scrollTop = view.scrollDOM.scrollHeight; view.scrollDOM.scrollLeft = 0;
    const aside = document.querySelector(".practice-sidebar");
    const container = aside.getAttribute("data-focus-phase") === "closed" ? aside : document.querySelector("#practice");
    container.scrollTop = container.scrollHeight;
  });
  await page.waitForFunction(() => { const e = document.querySelector(".cm-content"), v = e.cmTile?.root?.view || e.cmView?.view; return v.viewport.to >= v.state.doc.length; });
  const state = await page.evaluate(() => {
    const e = document.querySelector(".cm-content"), view = e.cmTile?.root?.view || e.cmView?.view;
    const last = view.coordsAtPos(view.state.doc.length), bar = document.querySelector(".practice-run-controls").getBoundingClientRect();
    const button = document.querySelector(".practice-run-controls button"), r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { lastBottom: last?.bottom, barTop: bar.top, height: innerHeight, buttonVisible: button === hit || button.contains(hit), doc: view.state.doc.toString() };
  });
  assert.equal(state.doc, source, `${label}: scrolling must not change the document`);
  assert(state.lastBottom <= state.barTop + 1 && state.lastBottom < state.height, `${label}: run bar must not cover the last line`);
  assert(state.buttonVisible, `${label}: the run controls must remain directly clickable`);
  await page.locator(".cm-content").evaluate((element) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    view.scrollDOM.scrollTop = 0; view.scrollDOM.scrollLeft = 0;
    document.querySelector(".practice-sidebar").scrollTop = 0;
    document.querySelector("#practice").scrollTop = 0;
  });
}

try {
  await fs.mkdir(screenshots, { recursive: true });
  assert.equal((await page.request.get(`${base}/api/problem/15`)).status(), 200);
  await page.goto(`${base}/p/15/`);
  await page.getByRole("textbox", { name: "代码编辑器", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector(".cm-content")?.getAttribute("contenteditable") === "true");
  if (process.argv.includes("--baseline")) {
    await setDocument(source);
    await page.locator(".cm-content").evaluate((element) => { const view = element.cmTile?.root?.view || element.cmView?.view; view.dispatch({ selection: { anchor: view.state.doc.line(12).from } }); });
    await page.waitForTimeout(80);
    const baseline = await metrics([1, 3, 5, 7, 12]);
    console.log(JSON.stringify({ baselineOnly: true, docUnchanged: baseline.doc === source, background: baseline.background, gutterX: baseline.gutterX, lines: baseline.lines }, null, 2));
    await page.locator(".practice-editor").screenshot({ path: path.join(screenshots, "before-editor-geometry.png") });
    await browser.close();
    process.exit(0);
  }
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") {
      await page.evaluate(() => { const e = document.querySelector(".cm-content"), v = e.cmTile?.root?.view || e.cmView?.view; window.__beforeEditorTheme = { e, v, doc: v.state.doc.toString(), selection: v.state.selection.main.toJSON() }; });
      await page.getByRole("button", { name: /点一下切到深色/ }).click();
      await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
      assert(await page.evaluate(() => { const e = document.querySelector(".cm-content"), v = e.cmTile?.root?.view || e.cmView?.view, old = window.__beforeEditorTheme; return e === old.e && v === old.v && v.state.doc.toString() === old.doc && JSON.stringify(v.state.selection.main.toJSON()) === JSON.stringify(old.selection); }), "Theme changes must keep the same editor, document and selection");
    }
    await setDocument(source);
    assert((await page.locator(".cm-editor").boundingBox()).height > 800, "At a 1080px viewport the normal editor must be taller than 800px");
    await page.locator(".cm-content").evaluate((element) => { const view = element.cmTile?.root?.view || element.cmView?.view; view.dispatch({ selection: { anchor: view.state.doc.line(12).from } }); });
    await page.waitForTimeout(60);
    assertGeometry(await metrics([1, 3, 5, 7, 12]), `${theme} initial`);
    await page.locator(".practice-editor").screenshot({ path: path.join(screenshots, `${theme}-geometry.png`) });
    await page.locator(".cm-content").evaluate((element) => { const view = element.cmTile?.root?.view || element.cmView?.view; view.scrollDOM.scrollTop = (60 - 1) * view.defaultLineHeight; });
    await page.waitForFunction(() => { const e = document.querySelector(".cm-content"), v = e.cmTile?.root?.view || e.cmView?.view, p = v.state.doc.line(60).from; return v.viewport.from <= p && v.viewport.to >= p; });
    assertGeometry(await metrics([60, 61, 62]), `${theme} vertically scrolled`);
    const before = await metrics([60]);
    await page.locator(".cm-content").evaluate((element) => { const view = element.cmTile?.root?.view || element.cmView?.view; view.scrollDOM.scrollLeft = 40; });
    await page.waitForTimeout(40);
    const after = await metrics([60]);
    assert(after.scrollLeft > 0, "The long fixture line must permit horizontal scrolling");
    assert(Math.abs(after.lines[0].origin - before.lines[0].origin + after.scrollLeft - before.scrollLeft) < 1, "Text column zero must move by exactly the horizontal scroll offset");
    assert(Math.abs(after.gutterX - before.gutterX) < 1, "Line numbers must remain fixed during horizontal scrolling");
    await lastLineReachable(`${theme} normal`);
    await setDocument(source, 5, 13);
    await page.evaluate(() => { const e = document.querySelector(".cm-content"), v = e.cmTile?.root?.view || e.cmView?.view; window.__geometryEditor = { e, v, selection: v.state.selection.main.toJSON() }; });
    await focusOpen();
    assert((await page.locator(".cm-editor").boundingBox()).height > 780, "Focus editor must be taller than its previous 780px cap");
    await lastLineReachable(`${theme} focus`);
    await focusClose();
    assert(await page.evaluate((expected) => { const e = document.querySelector(".cm-content"), v = e.cmTile?.root?.view || e.cmView?.view; return e === window.__geometryEditor.e && v === window.__geometryEditor.v && v.state.doc.toString() === expected && JSON.stringify(v.state.selection.main.toJSON()) === JSON.stringify(window.__geometryEditor.selection); }, source), "Focus/theme must preserve document, selection and the same CodeMirror instance");
    await completionKeys(theme);
    await openCompletion();
    await page.locator(".practice-sidebar").screenshot({ path: path.join(screenshots, `${theme}-completion.png`) });
    await page.keyboard.press("Escape");
    await focusOpen();
    await openCompletion();
    await page.screenshot({ path: path.join(screenshots, `${theme}-focus-completion.png`) });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".practice-sidebar").getAttribute("data-focus-phase"), "open", "Completion Escape must leave focus mode open");
    await focusClose();
  }
  assert.deepEqual(errors, [], "No unhandled browser exceptions");
  console.log(JSON.stringify({ measurements, screenshots }, null, 2));
} catch (error) {
  await page.screenshot({ path: path.join(screenshots, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
