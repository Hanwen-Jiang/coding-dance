// Real-browser checks for the compact editor, empty ACM workspace and lazy test panel.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { legacyAcmTemplate, previousAcmTemplate, starterHash } = require(path.join(root, "tools/practice/templates.cjs"));
const data = JSON.parse(await fs.readFile(path.join(root, "tools/practice/data/0015.json"), "utf8"));
const old = legacyAcmTemplate(data.signature, data.parameterNames, "python");
const short = previousAcmTemplate(data.signature, data.parameterNames, "python");
const oldTs = legacyAcmTemplate(data.signature, data.parameterNames, "typescript");
const edited = "// user-owned-code\nconsole.log('preserve me');";
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const screenshots = path.join(os.tmpdir(), "leetcode-practice-clean-ui");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "light" });
await context.addInitScript(({ old, short, oldTs, edited }) => {
  if (window.top !== window || localStorage.getItem("clean-ui-seeded")) return;
  localStorage.setItem("clean-ui-seeded", "yes");
  localStorage.setItem("hot100:practice:dock", "open"); // 练习区默认收起；这里测的是编辑器，先当作用户展开过
  localStorage.setItem("hot100:practice:options", JSON.stringify({ mode: "acm", language: "python" }));
  localStorage.setItem("hot100:practice:draft:15:acm:python", short);
  localStorage.setItem("hot100:practice:draft:15:acm:python:before-template-migration", old);
  localStorage.setItem("hot100:practice:draft:15:acm:typescript", oldTs);
  localStorage.setItem("hot100:practice:draft:15:acm:javascript", edited);
}, { old, short, oldTs, edited });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const editor = () => page.getByRole("textbox", { name: "代码编辑器", exact: true });
async function ready() { await editor().waitFor(); await page.waitForFunction(() => document.querySelector(".cm-content")?.getAttribute("contenteditable") === "true"); }
async function language(name) {
  await page.locator('.practice-editor-toolbar button[aria-label="练习语言"]').click();
  await page.getByRole("option", { name, exact: true }).click();
  await ready();
  await page.waitForFunction((name) => document.querySelector('[data-slot="select-value"]')?.textContent?.includes(name), name);
}
async function code(value) { await editor().click(); await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.insertText(value); await page.keyboard.press("Escape"); }
async function finished() { await page.getByText("全部通过", { exact: true }).or(page.getByText("有用例未通过", { exact: true })).or(page.getByText("运行完成", { exact: true })).first().waitFor({ timeout: 90000 }); }
async function screenshot(name) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(screenshots, name), animations: "disabled" }); }

try {
  await fs.mkdir(screenshots, { recursive: true });
  await page.goto(`${base}/p/15/`);
  await ready();
  assert.equal(await editor().textContent(), "");
  const migrated = await page.evaluate((hash) => ({ code: localStorage.getItem("hot100:practice:draft:15:acm:python"), old: localStorage.getItem("hot100:practice:draft:15:acm:python:before-template-migration"), generation: localStorage.getItem(`hot100:practice:draft:15:acm:python:before-template-migration:${hash}`) }), starterHash(short));
  assert.equal(migrated.code, ""); assert.equal(migrated.old, old); assert.equal(migrated.generation, short);
  await language("TypeScript");
  assert.equal(await editor().textContent(), "");
  assert.equal(await page.evaluate((hash) => localStorage.getItem(`hot100:practice:draft:15:acm:typescript:before-template-migration:${hash}`), starterHash(oldTs)), oldTs);
  await language("JavaScript");
  assert((await editor().innerText()).includes("user-owned-code"));
  assert.equal(await page.evaluate(() => localStorage.getItem("hot100:practice:draft:15:acm:javascript")), edited);
  await language("Python");
  assert.equal(await page.getByTestId("practice-test-panel").count(), 0);
  const sidebar = await page.locator(".practice-sidebar").innerText();
  for (const text of ["solution.py", "solution.js", "solution.ts", "草稿自动保存在本机", "草稿已保存到本机", "Ctrl /", "快捷运行", "代码在浏览器中运行", "测试使用本项目的用例"]) assert(!sidebar.includes(text), text);
  assert.equal(await page.getByRole("button", { name: "写代码", exact: true }).count(), 0);
  const controls = await page.evaluate(() => ({ editorHeight: document.querySelector(".cm-editor").getBoundingClientRect().height, resetY: document.querySelector('[aria-label="重置代码"]').getBoundingClientRect().y, toolbarY: document.querySelector(".practice-editor-toolbar").getBoundingClientRect().y, toolbarH: document.querySelector(".practice-editor-toolbar").getBoundingClientRect().height }));
  assert(controls.editorHeight >= 560);
  assert(controls.resetY >= controls.toolbarY && controls.resetY < controls.toolbarY + controls.toolbarH);
  await screenshot("1920-acm-blank-collapsed.png");
  console.log("✓ Blank ACM, two-generation safe migration, language dropdown, toolbar reset and cleaned text");

  await language("JavaScript");
  await page.getByRole("button", { name: "重置代码", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert((await editor().innerText()).includes("user-owned-code"));
  await page.getByRole("button", { name: "重置代码", exact: true }).click();
  await page.getByRole("button", { name: "确认重置", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".cm-content")?.textContent === "");
  await page.getByRole("button", { name: "运行示例", exact: true }).click();
  await page.getByTestId("practice-test-panel").waitFor();
  await finished();
  await page.getByText("（无输出）", { exact: true }).waitFor();
  assert((await page.locator("#practice").innerText()).includes("程序没有输出"));
  await screenshot("1920-acm-empty-run-expanded.png");
  const panel = await page.getByTestId("practice-test-panel").elementHandle();
  await page.getByRole("radio", { name: "示例", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "示例 2", exact: true }).count(), 1);
  await page.getByRole("radio", { name: "自定义", exact: true }).click();
  await page.getByRole("textbox", { name: "自定义预期结果", exact: true }).fill("");
  await code('console.log("custom-output");');
  await page.getByRole("button", { name: "运行自定义", exact: true }).click();
  await finished();
  await page.getByText("未设置预期，仅运行", { exact: true }).waitFor();
  assert(await page.evaluate((panel) => panel === document.querySelector('[data-testid="practice-test-panel"]'), panel));
  console.log("✓ Test panel appears only after running, opens once, and preserves editable custom tests");

  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await page.locator('[data-focus-phase="open"]').waitFor();
  const focus = await page.evaluate(() => ({ left: document.querySelector(".practice-focus-statement").getBoundingClientRect().toJSON(), right: document.querySelector(".practice-editor-column").getBoundingClientRect().toJSON() }));
  assert(focus.left.right < focus.right.x && focus.left.width > 300 && focus.right.width > 300);
  await page.screenshot({ path: path.join(screenshots, "1920-focus-left-problem-right-code.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.locator('[data-focus-phase="closed"]').waitFor();
  await page.getByRole("button", { name: /点一下切到深色/ }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await screenshot("1920-dark-expanded.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".practice-sidebar").evaluate((node) => window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 80));
  await page.screenshot({ path: path.join(screenshots, "390-dark-editor.png"), animations: "disabled" });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await page.locator('[data-focus-phase="open"]').waitFor();
  await page.screenshot({ path: path.join(screenshots, "390-dark-focus.png"), animations: "disabled" });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.keyboard.press("Escape");
  await page.locator('[data-focus-phase="closed"]').waitFor();
  assert.deepEqual(errors, []);
  console.log(`Clean practice UI browser checks passed. Screenshots: ${screenshots}`);
} catch (error) {
  await page.screenshot({ path: path.join(screenshots, "failure.png"), fullPage: true }).catch(() => {});
  console.error("Browser errors:", errors);
  throw error;
} finally { await browser.close(); }
