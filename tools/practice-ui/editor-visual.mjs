// Visual-only browser regression: VS Code colors, completion widgets and editor boundaries.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const screenshots = path.join(os.tmpdir(), "leetcode-editor-visual");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "light" });
await context.addInitScript(() => {
  if (window.top === window) localStorage.setItem("hot100:practice:options", JSON.stringify({ mode: "acm", language: "python" }));
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const editor = () => page.getByRole("textbox", { name: "代码编辑器", exact: true });
const source = {
  Python: `n = int(input())

nums = list(map(int, input().split()))

dp = [1] * n

for i in range(n):
    for j in range(i):
        if nums[i] > nums[j]:
            dp[i] = max(dp[i], dp[j] + 1)

print(max(dp))

# Colors follow VS Code Light+ / Dark+.
class Counter:
    def label(self, count: int = 2) -> str:
        return "count: " + str(count)
`,
  JavaScript: `const title = "Counter";
const factor = 2;

// Variables, classes and functions have separate colors.
class Counter {
    constructor(value = 0) {
        this.value = value;
    }
    label() {
        return title + ": " + this.value * factor;
    }
}

function makeCounter(value) {
    return new Counter(value);
}
const result = makeCounter(3).label();
console.log(result);
`,
  TypeScript: `interface CounterOptions {
    start: number;
    enabled: boolean;
}

const options: CounterOptions = { start: 2, enabled: true };
// Type annotations use the Light+ / Dark+ type colors.
class Counter {
    value: number;
    constructor(options: CounterOptions) {
        this.value = options.start;
    }
    label(prefix: string): string {
        return prefix + ": " + this.value;
    }
}
function formatCounter(counter: Counter): string {
    return counter.label("count");
}
const result = formatCounter(new Counter(options));
`,
};
async function ready() { await editor().waitFor(); await page.waitForFunction(() => document.querySelector(".cm-content")?.getAttribute("contenteditable") === "true"); }
async function language(name) {
  await page.locator('.practice-editor-toolbar button[aria-label="练习语言"]').click();
  await page.getByRole("option", { name, exact: true }).click();
  await ready();
  await page.waitForFunction((name) => document.querySelector('[data-slot="select-value"]')?.textContent?.includes(name), name);
}
async function write(value) {
  await editor().click(); await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.insertText(value); await page.keyboard.press("Escape");
  await page.evaluate(() => { const element = document.querySelector(".cm-content"), view = element.cmTile?.root?.view || element.cmView?.view; view.dispatch({ selection: { anchor: 0 } }); view.scrollDOM.scrollTop = 0; view.scrollDOM.scrollLeft = 0; });
}
async function cropEditor(name) {
  const box = await page.locator(".cm-editor").boundingBox();
  await page.screenshot({ path: path.join(screenshots, name), clip: { x: box.x, y: box.y, width: box.width, height: Math.min(550, box.height) }, animations: "disabled" });
}
async function completion(prefix, filename) {
  await write(prefix);
  await page.keyboard.press("ControlOrMeta+End"); await page.keyboard.press("Control+Space");
  const popup = page.locator(".cm-tooltip-autocomplete");
  await popup.waitFor();
  const styles = await popup.evaluate((node) => {
    const style = getComputedStyle(node), selected = node.querySelector('[aria-selected="true"]'), row = getComputedStyle(selected), matched = node.querySelector(".cm-completionMatchedText"), icon = node.querySelector(".cm-completionIcon");
    return { radius: parseFloat(style.borderRadius), border: style.borderColor, shadow: style.boxShadow, selected: row.backgroundColor, rowHeight: selected.getBoundingClientRect().height, matchedDecoration: getComputedStyle(matched).textDecorationLine, icon: getComputedStyle(icon, "::after").content };
  });
  assert(styles.radius >= 8 && styles.shadow !== "none");
  assert(styles.rowHeight >= 24 && styles.rowHeight <= 30);
  assert(!["rgb(17, 119, 204)", "rgb(51, 68, 119)"].includes(styles.selected));
  assert.equal(styles.matchedDecoration, "none");
  assert(styles.icon !== "none" && styles.icon !== '""');
  const box = await page.locator(".cm-editor").boundingBox(), menu = await popup.boundingBox();
  await page.screenshot({ path: path.join(screenshots, filename), clip: { x: box.x, y: box.y, width: Math.min(box.width, Math.max(360, menu.x + menu.width - box.x + 20)), height: Math.min(box.height, Math.max(180, menu.y + menu.height - box.y + 20)) }, animations: "disabled" });
  await page.keyboard.press("Escape");
  return styles;
}

try {
  await fs.mkdir(screenshots, { recursive: true });
  await page.goto(`${base}/p/15/`); await ready();
  const report = {};
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") {
      const instance = await page.locator(".cm-editor").elementHandle();
      await page.getByRole("button", { name: /点一下切到深色/ }).click();
      await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
      assert(await page.evaluate((instance) => instance === document.querySelector(".cm-editor"), instance));
    }
    report[theme] = {};
    for (const name of ["Python", "JavaScript", "TypeScript"]) {
      await language(name); await write(source[name]);
      if (name === "Python") await page.evaluate(() => { const element = document.querySelector(".cm-content"), view = element.cmTile?.root?.view || element.cmView?.view; view.dispatch({ selection: { anchor: view.state.doc.line(12).from } }); });
      const info = await page.locator(".cm-editor").evaluate((node) => {
        const content = node.querySelector(".cm-content"), view = content.cmTile?.root?.view || content.cmView?.view;
        return { background: getComputedStyle(node).backgroundColor, fontSize: getComputedStyle(content).fontSize, lineHeight: getComputedStyle(content).lineHeight, colors: [...new Set([...node.querySelectorAll(".cm-line span")].map((span) => getComputedStyle(span).color))], doc: view.state.doc.toString(), height: node.getBoundingClientRect().height };
      });
      assert.equal(info.doc, source[name]); assert.equal(info.fontSize, "14px"); assert.equal(info.lineHeight, "24px");
      assert(info.colors.length >= 6, `${theme}/${name}: expected distinct syntax colors`);
      assert.equal(info.background, theme === "light" ? "rgb(255, 255, 255)" : "rgb(30, 30, 30)");
      assert(info.height >= 800 && info.height <= 850);
      await cropEditor(`${theme}-${name.toLowerCase()}.png`);
      report[theme][name] = info;
    }
    await language("Python");
    report[theme].pythonCompletion = await completion("li", `${theme}-python-completion.png`);
    await language("JavaScript");
    report[theme].javascriptCompletion = await completion("fun", `${theme}-javascript-completion-detail.png`);
    assert(await page.evaluate(() => document.querySelector(".practice-sidebar")?.textContent?.includes("动手练习")));
    console.log(`✓ ${theme}: Python / JavaScript / TypeScript VS Code colors and styled completion widgets`);
  }

  await language("Python"); await write(source.Python);
  await page.setViewportSize({ width: 1920, height: 1200 });
  const tall = await page.locator(".cm-editor").boundingBox(), controls = await page.locator(".practice-run-controls").boundingBox();
  assert(tall.height >= 930 && controls.y + controls.height <= 1200);
  await page.screenshot({ path: path.join(screenshots, "tall-editor-1200.png"), animations: "disabled" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await page.locator('[data-focus-phase="open"]').waitFor();
  await write("li"); await page.keyboard.press("ControlOrMeta+End"); await page.keyboard.press("Control+Space");
  await page.locator(".cm-tooltip-autocomplete").waitFor();
  await page.screenshot({ path: path.join(screenshots, "focus-python-completion.png"), animations: "disabled" });
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  await page.locator('[data-focus-phase="closed"]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await write(source.Python);
  await page.locator(".practice-sidebar").evaluate((node) => window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 80));
  await page.screenshot({ path: path.join(screenshots, "mobile-dark-editor.png"), animations: "disabled" });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(screenshots, "computed-theme-report.json"), JSON.stringify(report, null, 2));
  console.log(`Editor visual browser checks passed. Screenshots: ${screenshots}`);
} catch (error) {
  await page.screenshot({ path: path.join(screenshots, "failure.png"), fullPage: true }).catch(() => {});
  console.error("Browser errors:", errors); throw error;
} finally { await browser.close(); }
