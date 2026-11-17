// Focused regression for the original-page/right-editor layout, official examples and draft migration.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { legacyAcmTemplate, starterHash } = require(path.join(root, "tools/practice/templates.cjs"));
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const screenshots = path.join(os.tmpdir(), "leetcode-practice-revision");
const readData = async (id) => JSON.parse(await fs.readFile(path.join(root, "tools/practice/data", `${String(id).padStart(4, "0")}.json`), "utf8"));
const p15 = await readData(15);
const oldPython = legacyAcmTemplate(p15.signature, p15.parameterNames, "python");
const modifiedJs = `// genuine-user-edit-do-not-delete\n${legacyAcmTemplate(p15.signature, p15.parameterNames, "javascript")}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "light" });
if (process.env.PRACTICE_LOCAL_FIXTURES) {
  // Read-only test fixtures avoid spending the unauthenticated GitHub API budget.
  await context.route("**/api/problem/*", async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split("/").at(-1));
    const padded = String(id).padStart(4, "0");
    const name = (await fs.readdir(path.join(root, "problems"))).find((file) => file.startsWith(`${padded}.`) && file.endsWith(".md"));
    const markdown = await fs.readFile(path.join(root, "problems", name), "utf8");
    const spec = JSON.parse(await fs.readFile(path.join(root, "tools/illustrations/data", `${padded}.json`), "utf8"));
    const statementHtml = markdown.split("## 题目描述")[1]?.split(/\r?\n## /)[0]?.trim() || "";
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ summary: { id, name: spec.name, level: spec.level, topic: spec.topic, tier: "Hot 20", order: 1, planOrder: 1, hasSpec: true, hasIllustration: false }, slug: markdown.match(/leetcode\.cn\/problems\/([\w-]+)/)?.[1] || null, statementHtml, spec, illustrationUrl: null, prev: null, next: null }) });
  });
}
await context.addInitScript(({ oldPython, modifiedJs }) => {
  if (window.top !== window) return;
  if (localStorage.getItem("practice-revision-seeded")) return;
  localStorage.setItem("practice-revision-seeded", "yes");
  localStorage.setItem("hot100:practice:options", JSON.stringify({ mode: "acm", language: "python" }));
  localStorage.setItem("hot100:practice:draft:15:acm:python", oldPython);
  localStorage.setItem("hot100:practice:draft:15:acm:javascript", modifiedJs);
  localStorage.setItem("hot100:practice:draft:999:leetcode:python", "unrelated-draft-must-stay");
}, { oldPython, modifiedJs });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const editor = () => page.getByRole("textbox", { name: "代码编辑器", exact: true });
async function ready() { await editor().waitFor(); await page.waitForFunction(() => document.querySelector(".cm-content")?.getAttribute("contenteditable") === "true"); }
async function mode(name) { await page.getByLabel("编程模式", { exact: true }).getByRole("radio", { name, exact: true }).click(); await page.waitForFunction((name) => document.querySelector('[aria-label="编程模式"] [aria-checked="true"]')?.textContent === name, name); await ready(); }
async function language(name) { await page.locator('.practice-editor-toolbar button[aria-label="练习语言"]').click(); await page.getByRole("option", { name, exact: true }).click(); await ready(); await page.waitForFunction((name) => document.querySelector('[data-slot="select-value"]')?.textContent?.includes(name), name); }
async function revealExamples() { if (!await page.getByTestId("practice-test-panel").count()) { await page.getByRole("button", { name: "运行示例", exact: true }).click(); await page.getByTestId("practice-test-panel").waitFor(); } await page.getByRole("radio", { name: "示例", exact: true }).click(); }
async function code(value) { await editor().click(); await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.insertText(value); await page.keyboard.press("Escape"); }
async function run(name = "运行示例") {
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByText("全部通过", { exact: true }).or(page.getByText("有用例未通过", { exact: true })).first().waitFor({ timeout: 90000 });
  assert.equal(await page.getByText("有用例未通过", { exact: true }).count(), 0, await page.locator("#practice").innerText());
}
async function shot(name) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(screenshots, name), animations: "disabled" }); }

try {
  await fs.mkdir(screenshots, { recursive: true });
  await page.goto(`${base}/p/15/`);
  await ready();
  const migrated = await page.evaluate((hash) => ({ code: localStorage.getItem("hot100:practice:draft:15:acm:python"), backup: localStorage.getItem(`hot100:practice:draft:15:acm:python:before-template-migration:${hash}`), unrelated: localStorage.getItem("hot100:practice:draft:999:leetcode:python") }), starterHash(oldPython));
  assert.equal(migrated.code, p15.starters.acm.python);
  assert.equal(migrated.backup, oldPython);
  assert.equal(migrated.unrelated, "unrelated-draft-must-stay");
  assert(!((await editor().innerText()).includes("_SIGNATURE")));
  await language("JavaScript");
  assert((await editor().innerText()).includes("genuine-user-edit-do-not-delete"));
  assert.equal(await page.evaluate(() => localStorage.getItem("hot100:practice:draft:15:acm:javascript")), modifiedJs);
  await language("Python");
  await shot("1920-acm-clean-template.png");
  console.log("✓ Only untouched legacy ACM templates migrate; backups and edited/unrelated drafts survive");

  await mode("LeetCode");
  await revealExamples();
  const input = page.getByTestId("practice-example-input");
  assert.equal(await input.innerText(), "nums = [-1,0,1,2,-1,-4]");
  assert.equal((await input.innerText()).split("\n").length, 1);
  assert.equal(await page.getByTestId("practice-example-output").innerText(), "[\n  [-1,-1,2],\n  [-1,0,1]\n]");
  await page.getByRole("button", { name: "示例 2", exact: true }).click();
  assert.equal(await input.innerText(), "nums = [0,1,1]");
  assert.equal(await page.getByTestId("practice-example-output").innerText(), "[]");
  await shot("1920-leetcode-official-example2.png");
  await page.getByRole("button", { name: "示例 3", exact: true }).click();
  assert.equal(await input.innerText(), "nums = [0,0,0]");
  await page.getByRole("button", { name: "示例 1", exact: true }).click();

  const desktop = await page.evaluate(() => {
    const left = document.querySelector(".problem-original"), right = document.querySelector(".practice-sidebar");
    const l = left.getBoundingClientRect(), r = right.getBoundingClientRect();
    return { leftWidth: l.width, rightX: r.x, leftRight: l.right, rightWidth: r.width, overflows: document.documentElement.scrollWidth > innerWidth,
      order: [...left.querySelectorAll("h2[id]")].map((node) => node.id), entries: document.querySelectorAll(".problem-study-bar .problem-study-entry").length,
      statementMaxHeight: getComputedStyle(document.querySelector("#statement").closest("section").querySelector(".card")).maxHeight };
  });
  // 宽度可以拖（默认练习区占 38%），正文至少 560px、练习区至少 360px
  assert(desktop.leftWidth >= 560 && desktop.rightWidth >= 360, JSON.stringify(desktop));
  assert(desktop.rightX > desktop.leftRight);
  assert(!desktop.overflows);
  // 练习区展开时是「写代码」的布局：题面之外的几节收成一排入口（用到时弹出面板），不再一路串下去
  assert.deepEqual(desktop.order, ["statement"]);
  assert(desktop.entries >= 5, `Entries for hints/demo/solution/mine (${desktop.entries})`);
  assert.equal(desktop.statementMaxHeight, "none");
  await page.evaluate(() => window.scrollTo(0, 600));
  assert(Math.abs((await page.locator(".practice-sidebar").boundingBox()).y - 80) < 2, "The independent right editor stays fixed while reading");
  assert(Math.abs((await page.locator(".problem-study-bar").boundingBox()).y - 57) < 2, "The entry bar stays under the header while reading");
  await page.screenshot({ path: path.join(screenshots, "1920-coding-layout.png"), animations: "disabled" });
  // 收起练习区：回到从上往下读的布局
  await page.getByRole("button", { name: "收起练习区", exact: true }).click();
  await page.locator("h2#hints").waitFor();
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".problem-original h2[id]")].map((n) => n.id)), ["statement", "hints", "demo", "solution", "history", "attempts", "points"]);
  await page.getByRole("button", { name: "展开练习区", exact: true }).click();
  await page.locator("h2#hints").waitFor({ state: "detached" });
  console.log("✓ Docked practice: coding layout (statement + entry bar); stowed: serial reading layout; editor fixed");

  await page.setViewportSize({ width: 1440, height: 1080 });
  await shot("1440-leetcode-right-editor.png");
  const medium = await page.evaluate(() => ({ l: document.querySelector(".problem-original").getBoundingClientRect().width, r: document.querySelector(".practice-sidebar").getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth, toc: getComputedStyle(document.querySelector(".problem-toc")).display }));
  assert(medium.l >= 560 && medium.r >= 360 && !medium.overflow && medium.toc === "none", JSON.stringify(medium));
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("390-original-page.png");
  await page.locator(".practice-sidebar").evaluate((node) => window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 80));
  await page.screenshot({ path: path.join(screenshots, "390-editor.png"), animations: "disabled" });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1920, height: 1080 });
  console.log(`✓ 1920 / 1440 / 390 layouts. Screenshots: ${screenshots}`);

  await page.goto(`${base}/p/1/`);
  await ready();
  await mode("LeetCode");
  await language("JavaScript");
  await code("function twoSum(nums, target) { const seen = new Map(); for (let i=0; i<nums.length; i++) { if(seen.has(target-nums[i])) return [seen.get(target-nums[i]),i]; seen.set(nums[i],i); } return []; }");
  await run();
  const reference = JSON.parse(await fs.readFile(path.join(root, "tools/illustrations/data/0001.json"), "utf8"));
  for (const [name, source] of [["TypeScript", reference.codes[0].langs.typescript.code], ["Python", reference.codes[0].code]]) {
    await language(name); await code(source); await run(); console.log(`✓ LeetCode ${name}: original official examples`);
  }
  await language("JavaScript");
  await run(); // 换语言后控制台是收起的，先跑一次示例把它打开
  await page.getByRole("radio", { name: "自定义", exact: true }).click();
  await page.getByRole("textbox", { name: "自定义参数 nums", exact: true }).fill("[3,3]");
  await page.getByRole("textbox", { name: "自定义参数 target", exact: true }).fill("6");
  await page.getByRole("textbox", { name: "自定义预期结果", exact: true }).fill("[0,1]");
  await run("运行自定义");
  const compactResult = await page.locator("#practice").innerText();
  assert(compactResult.includes("nums = [3,3]\ntarget = 6") && compactResult.includes("[0,1]"));
  console.log("✓ Named compact arguments, separate custom fields and compact actual/expected results");

  await mode("ACM");
  for (const [name, source] of [
    ["JavaScript", 'const a=require("fs").readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);const n=a[0],v=a.slice(1,n+1),t=a[n+1];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(v[i]+v[j]===t){console.log("2\\n"+i+" "+j);process.exit(0);}'],
    ["TypeScript", 'import { readFileSync } from "node:fs";const a=readFileSync(0,"utf8").trim().split(/\\s+/).map(Number);const n=a[0],v=a.slice(1,n+1),t=a[n+1];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(v[i]+v[j]===t){console.log("2\\n"+i+" "+j);process.exit(0);}'],
    ["Python", 'import sys\na=list(map(int,sys.stdin.read().split()))\nn=a[0]\nv=a[1:n+1]\nt=a[n+1]\nfor i in range(n):\n    for j in range(i+1,n):\n        if v[i]+v[j]==t:\n            print(2)\n            print(i,j)\n            sys.exit(0)\n'],
  ]) {
    await language(name); await code(source); await run(); console.log(`✓ Clean ACM full program ${name}, official examples and normal exit`);
  }

  for (const [id, required] of [[142, ["head = [3,2,0,-4]", "pos = 1"]], [160, ["listA", "listB", "skipA", "skipB"]]]) {
    await page.goto(`${base}/p/${id}/`); await ready(); await mode("LeetCode"); await revealExamples();
    const display = await page.getByTestId("practice-example-input").innerText();
    for (const value of required) assert(display.includes(value), `${id}: ${display}`);
    assert((await page.getByTestId("practice-example-output").innerText()).includes("返回节点下标"));
  }
  console.log("✓ Cycle/intersection list examples expose official fields and explain node results");

  await page.goto(`${base}/`);
  assert.equal(await page.locator("main").evaluate((node) => node.getBoundingClientRect().width), 1152);
  assert.equal(await page.locator(".problem-page-layout").count(), 0);
  assert.deepEqual(errors, []);
  console.log("Practice revision browser checks passed; homepage width remains unchanged.");
} catch (error) {
  await page.screenshot({ path: path.join(screenshots, "failure.png"), fullPage: true }).catch(() => {});
  console.error("Unhandled browser errors:", errors);
  throw error;
} finally { await browser.close(); }
