// Independent reset-confirmation checks; no algorithm execution or user browser access.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const screenshots = process.env.PRACTICE_RESET_SCREENSHOTS || path.join(os.tmpdir(), "leetcode-reset-modal-review");
const currentKey = "hot100:practice:draft:15:acm:python";
const lcKey = "hot100:practice:draft:15:leetcode:python";
const original = "print('keep the current draft')\n# preserve this selected region";
const drafts = {
  [currentKey]: original,
  [lcKey]: "class Solution:\n    def threeSum(self, nums):\n        return ['keep other mode']\n",
  "hot100:practice:draft:15:acm:javascript": "console.log('keep other language');",
  "hot100:practice:draft:1:acm:python": "print('keep another problem')",
};
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
await context.addInitScript((values) => {
  if (window !== window.top) return;
  localStorage.setItem("hot100:practice:options", JSON.stringify({ mode: "acm", language: "python" }));
  for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
}, drafts);
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const reset = page.getByRole("button", { name: "重置代码", exact: true });
const modal = page.getByTestId("practice-reset-modal");

async function code() {
  return page.locator(".cm-content").evaluate((element) => (element.cmTile?.root?.view || element.cmView?.view).state.doc.toString());
}
async function selectionSnapshot() {
  await page.locator(".cm-content").evaluate((element) => {
    const view = element.cmTile?.root?.view || element.cmView?.view;
    view.dispatch({ selection: { anchor: 6, head: 18 } });
    window.__resetModalEditor = { element, view, doc: view.state.doc.toString(), selection: view.state.selection.main.toJSON() };
  });
}
async function assertPreserved(label) {
  assert(await page.locator(".cm-content").evaluate((element) => {
    const view = element.cmTile?.root?.view || element.cmView?.view, saved = window.__resetModalEditor;
    return element === saved.element && view === saved.view && view.state.doc.toString() === saved.doc && JSON.stringify(view.state.selection.main.toJSON()) === JSON.stringify(saved.selection);
  }), `${label}: cancellation must preserve the same editor, code and selection`);
}
async function snapshotDrafts() {
  return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((key) => key.startsWith("hot100:practice:draft:")).sort().map((key) => [key, localStorage.getItem(key)])));
}
async function assertOnlyChanged(before, key, expected) {
  const after = await snapshotDrafts();
  assert.equal(after[key], expected);
  for (const [other, value] of Object.entries(before)) if (other !== key) assert.equal(after[other], value, `Reset must preserve ${other}`);
  assert.deepEqual(Object.keys(after), Object.keys(before), "Reset must not clear or introduce unrelated draft keys");
}
async function closeWait() {
  await modal.waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement === document.querySelector('button[aria-label="重置代码"]'));
}
async function openModal(label) {
  const before = await page.locator(".cm-editor").boundingBox();
  await reset.click();
  await modal.waitFor();
  await page.getByRole("alertdialog", { name: "重置代码？", exact: true }).waitFor();
  const after = await page.locator(".cm-editor").boundingBox();
  assert(Math.abs(after.y - before.y) < 1 && Math.abs(after.height - before.height) < 1, `${label}: confirmation must not add an inline row or squeeze the editor`);
  const labelled = await modal.evaluate((element) => {
    const ids = (element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    return ids.map((id) => document.getElementById(id)?.textContent || "").join(" ");
  });
  assert(labelled.includes("重置代码"), "The alert dialog must have an accessible heading");
  const cancel = modal.getByRole("button", { name: "取消", exact: true });
  await page.waitForFunction(() => { const el = document.querySelector('[data-testid="practice-reset-modal"]'); return [...el.querySelectorAll("button")].some((button) => button.textContent.trim() === "取消" && button === document.activeElement); });
  for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    assert(await modal.evaluate((element) => element.contains(document.activeElement)), `${label}: keyboard focus must stay in the confirmation`);
  }
  assert(await cancel.evaluate((element) => { const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return element === hit || element.contains(hit); }), `${label}: the modal must be above underlying overlays`);
}

try {
  await fs.mkdir(screenshots, { recursive: true });
  const problemResponse = await page.request.get(`${base}/api/practice/15`);
  assert.equal(problemResponse.status(), 200);
  const problem = await problemResponse.json();
  assert.equal(problem.starters.acm.python, "");
  await page.goto(`${base}/p/15/`);
  await page.getByRole("textbox", { name: "代码编辑器", exact: true }).waitFor();
  await page.waitForFunction((expected) => { const e = document.querySelector(".cm-content"), v = e?.cmTile?.root?.view || e?.cmView?.view; return v?.state.doc.toString() === expected && e.getAttribute("contenteditable") === "true"; }, original);
  await selectionSnapshot();
  await openModal("normal cancel");
  await page.screenshot({ path: path.join(screenshots, "normal-confirmation.png") });
  await modal.getByRole("button", { name: "取消", exact: true }).click();
  await closeWait();
  await assertPreserved("normal cancel");
  await openModal("normal Escape");
  await page.keyboard.press("Escape");
  await closeWait();
  await assertPreserved("normal Escape");
  console.log("✓ Normal Cancel/Escape preserve source, selection and CodeMirror, restore reset focus, and do not resize the editor.");

  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".practice-sidebar")?.getAttribute("data-focus-phase") === "open");
  await page.locator(".practice-sidebar").evaluate(async (element) => { await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {}))); });
  await selectionSnapshot();
  await openModal("focus Escape");
  await page.screenshot({ path: path.join(screenshots, "focus-confirmation.png") });
  await page.keyboard.press("Escape");
  await closeWait();
  assert.equal(await page.locator(".practice-sidebar").getAttribute("data-focus-phase"), "open", "Escape must close only the reset confirmation");
  assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden", "Focus workspace must keep its scroll lock");
  await assertPreserved("focus Escape");
  const editor = page.getByRole("textbox", { name: "代码编辑器", exact: true });
  await editor.click(); await page.keyboard.press("ControlOrMeta+End"); await page.keyboard.insertText("\n# editable after modal");
  await page.waitForFunction((key) => localStorage.getItem(key)?.endsWith("# editable after modal"), currentKey);
  assert((await code()).endsWith("# editable after modal"), "Editing must work after closing the confirmation");
  const beforeAcmReset = await snapshotDrafts();
  await openModal("focus confirm");
  await modal.getByRole("button", { name: "确认重置", exact: true }).click();
  await closeWait();
  await page.waitForFunction(() => { const e = document.querySelector(".cm-content"), v = e?.cmTile?.root?.view || e?.cmView?.view; return v?.state.doc.toString() === ""; }, undefined, { timeout: 3000 });
  assert.equal(await code(), "");
  await assertOnlyChanged(beforeAcmReset, currentKey, "");
  assert.equal(await page.locator(".practice-sidebar").getAttribute("data-focus-phase"), "open");
  console.log("✓ Focus modal layering, alert semantics, focus trap, Escape isolation, editing afterwards, and current ACM draft reset.");

  await page.getByRole("button", { name: "退出专注模式", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".practice-sidebar")?.getAttribute("data-focus-phase") === "closed");
  await page.getByLabel("编程模式", { exact: true }).getByRole("radio", { name: "LeetCode", exact: true }).click();
  await page.waitForFunction((expected) => { const e = document.querySelector(".cm-content"), v = e?.cmTile?.root?.view || e?.cmView?.view; return v?.state.doc.toString() === expected; }, drafts[lcKey]);
  const beforeLcReset = await snapshotDrafts();
  await openModal("LeetCode confirm");
  await modal.getByRole("button", { name: "确认重置", exact: true }).click();
  await closeWait();
  await page.waitForFunction((expected) => { const e = document.querySelector(".cm-content"), v = e?.cmTile?.root?.view || e?.cmView?.view; return v?.state.doc.toString() === expected; }, problem.starters.leetcode.python);
  assert.equal(await code(), problem.starters.leetcode.python);
  await assertOnlyChanged(beforeLcReset, lcKey, problem.starters.leetcode.python);
  assert.deepEqual(errors, [], "No unhandled browser errors");
  console.log(`✓ LeetCode restores its current template only; other modes/languages/problems remain untouched. Screenshots: ${screenshots}`);
} catch (error) {
  await page.screenshot({ path: path.join(screenshots, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
