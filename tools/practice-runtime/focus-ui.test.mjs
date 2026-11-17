// Independent focus-workspace regression against the real local preview.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const screenshots = process.env.PRACTICE_FOCUS_SCREENSHOTS || path.join(os.tmpdir(), "leetcode-practice-focus-review");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: "no-preference" });
await context.addInitScript(() => { if (window === window.top) localStorage.setItem("hot100:practice:options", JSON.stringify({ mode: "leetcode", language: "javascript" })); });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const sidebar = page.locator(".practice-sidebar");
const phase = (value) => page.waitForFunction((expected) => document.querySelector(".practice-sidebar")?.getAttribute("data-focus-phase") === expected, value);

async function assertPreserved(label) {
  const state = await page.evaluate(() => {
    const saved = window.__practiceFocusRefs;
    const content = document.querySelector(".cm-content");
    const view = content?.cmTile?.root?.view || content?.cmView?.view;
    return {
      sameContent: content === saved.content,
      sameEditor: document.querySelector(".cm-editor") === saved.editor,
      sameView: view === saved.view,
      sameReport: document.querySelector('#practice [aria-live="polite"]') === saved.report,
      code: view?.state.doc.toString(),
      selection: view?.state.selection.main.toJSON(),
    };
  });
  assert(state.sameContent && state.sameEditor && state.sameView && state.sameReport, `${label}: focus must not remount the editor or results`);
  assert.equal(state.code, "function threeSum(nums) { return []; }\n// keep this user's draft and selection");
  assert.deepEqual(state.selection, { anchor: 9, head: 17 }, `${label}: selection must survive`);
}

try {
  await fs.mkdir(screenshots, { recursive: true });
  const api = await page.request.get(`${base}/api/problem/15`);
  assert.equal(api.status(), 200, "Use the real local resource adapter, without route fixtures");
  await page.goto(`${base}/p/15/`);
  const editor = page.getByRole("textbox", { name: "代码编辑器", exact: true });
  await editor.waitFor();
  await page.waitForFunction(() => document.querySelector(".cm-content")?.getAttribute("contenteditable") === "true");
  await phase("closed");
  assert.equal(await page.getByTestId("practice-test-panel").count(), 0, "Test panel starts unmounted");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText("function threeSum(nums) { return []; }\n// keep this user's draft and selection");
  await page.getByRole("button", { name: "运行示例", exact: true }).click();
  await page.getByText("有用例未通过", { exact: true }).waitFor();
  await page.getByTestId("practice-test-panel").waitFor();
  const originalOverflow = await page.evaluate(() => document.body.style.overflow);
  await page.evaluate(() => {
    const content = document.querySelector(".cm-content");
    const view = content?.cmTile?.root?.view || content?.cmView?.view;
    if (!view) throw Error("Cannot find this installed CodeMirror version's view");
    view.dispatch({ selection: { anchor: 9, head: 17 } });
    window.__practiceFocusRefs = { content, editor: document.querySelector(".cm-editor"), view, report: document.querySelector('#practice [aria-live="polite"]') };
  });
  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await phase("open");
  assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
  await assertPreserved("open");
  const left = await page.locator(".practice-focus-statement").boundingBox(), right = await page.locator(".practice-editor-column").boundingBox();
  assert(left && right && right.x >= left.x + left.width - 1, "Focus mode must show the statement on the left and the same editor on the right");
  await sidebar.evaluate(async (element) => { await Promise.all(element.getAnimations().map((a) => a.finished.catch(() => {}))); });
  await page.screenshot({ path: path.join(screenshots, "focus-open.png") });

  // The language popup must be above the focus workspace, and its Escape must
  // close only the popup, leaving the workspace open.
  await page.locator('.practice-editor-toolbar button[aria-label="练习语言"]').click();
  const option = page.getByRole("option", { name: "JavaScript", exact: true }).or(page.getByRole("menuitemradio", { name: "JavaScript", exact: true })).or(page.getByRole("menuitem", { name: "JavaScript", exact: true })).first();
  await option.waitFor();
  assert(await option.evaluate((element) => { const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return element === hit || element.contains(hit); }), "Language popup must not be covered by the focus overlay");
  await page.keyboard.press("Escape");
  await option.waitFor({ state: "hidden" });
  assert.equal(await sidebar.getAttribute("data-focus-phase"), "open", "Escape in the popup must not dismiss focus mode");
  await assertPreserved("popup Escape");

  await page.getByRole("button", { name: "退出专注模式", exact: true }).click();
  const closing = await sidebar.evaluate((element) => ({ phase: element.getAttribute("data-focus-phase"), position: getComputedStyle(element).position, animation: getComputedStyle(element).animationName, originalVisibility: getComputedStyle(document.querySelector(".problem-original")).visibility, visible: element.getBoundingClientRect().width > 0, locked: document.body.style.overflow }));
  assert.equal(closing.phase, "closing", "Closing uses a single common-parent exit animation");
  assert.equal(closing.position, "fixed", "Keep both focus panels together during exit");
  assert.notEqual(closing.animation, "none", "The common parent performs a real exit animation");
  assert.equal(closing.originalVisibility, "hidden", "Hide the entire original title, headings and body until exit completes");
  assert(closing.visible && closing.locked === "hidden", "Keep the workspace and scroll lock through exit animation");
  await phase("closed");
  assert.equal(await page.evaluate(() => document.body.style.overflow), originalOverflow);
  await assertPreserved("closed");

  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await phase("open");
  await page.keyboard.press("Escape");
  await phase("closed");
  await assertPreserved("workspace Escape");
  console.log("✓ Same CodeMirror DOM/view, draft, selection and result DOM survive focus enter/exit; popup layering and Escape; real closing animation and scroll-lock lifetime.");

  const reduced = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  reducedPage.on("pageerror", (error) => errors.push(error.message));
  await reducedPage.goto(`${base}/p/15/`);
  await reducedPage.getByRole("textbox", { name: "代码编辑器", exact: true }).waitFor();
  await reducedPage.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await reducedPage.waitForFunction(() => document.querySelector(".practice-sidebar")?.getAttribute("data-focus-phase") === "open");
  const duration = await reducedPage.locator(".practice-sidebar").evaluate((element) => Math.max(...getComputedStyle(element).animationDuration.split(",").map((part) => parseFloat(part))));
  assert(duration <= 0.01, "Reduced motion must remove or shorten the focus animation");
  await reducedPage.evaluate(() => { window.__reducedExit = { start: performance.now() }; const element = document.querySelector(".practice-sidebar"); const observer = new MutationObserver(() => { if (element.getAttribute("data-focus-phase") === "closed") { window.__reducedExit.duration = performance.now() - window.__reducedExit.start; observer.disconnect(); } }); observer.observe(element, { attributes: true, attributeFilter: ["data-focus-phase"] }); });
  await reducedPage.getByRole("button", { name: "退出专注模式", exact: true }).click();
  await reducedPage.waitForFunction(() => window.__reducedExit?.duration !== undefined);
  assert(await reducedPage.evaluate(() => window.__reducedExit.duration < 300), "Reduced-motion closing must complete promptly");
  assert.notEqual(await reducedPage.evaluate(() => document.body.style.overflow), "hidden");
  await reduced.close();
  assert.deepEqual(errors, [], "No unhandled browser errors");
  console.log(`✓ Reduced-motion focus exit. Screenshot: ${path.join(screenshots, "focus-open.png")}`);
} catch (error) {
  await page.screenshot({ path: path.join(screenshots, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
