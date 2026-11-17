// 练习「测试全部」记进进度仓：真浏览器里跑，登录状态和进度仓接口用 Playwright 拦下来假装（不碰真实账号）。
// 先在 site/ 里 npm run build，再开本地预览（node tools/dev/preview.mjs），然后在仓库根目录运行：node tools/practice-ui/record.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const spec = JSON.parse(await fs.readFile(path.join(root, "tools/illustrations/data/0015.json"), "utf8"));
const browser = await chromium.launch({ executablePath: chrome, headless: true });

const session = (user) => ({
  configured: true, template: "Hanwen-Jiang/hot100-progress-template", repoName: "hot100-progress", createUrl: "#",
  user: user ? { login: "demo-user", avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACw=" } : null,
  repo: user ? { name: "demo-user/hot100-progress", url: "#", exists: true, accessible: true, installed: true, canCreate: true, manageUrl: null } : null,
  starred: true, stars: [],
});

/** 一个假装登录（或没登录）的浏览器；records 收到网页发来的记录请求，reply 决定怎么回 */
async function open({ user = true, reply = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [], records = [], solutions = { count: 0 };
  page.on("pageerror", (e) => errors.push(e.message));
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await context.route("**/api/session", (route) => json(route, session(user)));
  await context.route("**/api/progress", (route) => json(route, { status: { 15: "尝试过" }, langs: {}, settings: null }));
  await context.route("**/api/solutions/*", (route) => { solutions.count++; return json(route, { history: [], attempts: [] }); });
  await context.route("**/api/practice/record", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    records.push(body);
    if (reply) return json(route, ...reply(body));
    const ok = body.result === "通过";
    return json(route, {
      sha: "f".repeat(40), url: "https://github.com/demo-user/hot100-progress/commit/fff",
      attempt: `attempts/0015.三数之和/2026-11-17.${records.length}.${body.result}.md`,
      solution: ok && records.length === 1 ? `solutions/${body.language}/0015.三数之和.${{ python: "py", javascript: "js", typescript: "ts" }[body.language]}` : null,
      status: ok && records.length === 1 ? "已通过" : null,
    });
  });
  await page.goto(`${base}/p/15/`);
  await page.getByRole("textbox", { name: "代码编辑器", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector(".cm-content")?.getAttribute("contenteditable") === "true");
  return { context, page, errors, records, solutions };
}
async function language(page, name) {
  await page.locator('.practice-editor-toolbar button[aria-label="练习语言"]').click();
  await page.getByRole("option", { name, exact: true }).click();
  await page.waitForFunction((name) => document.querySelector('[data-slot="select-value"]')?.textContent?.includes(name), name);
}
async function writeCode(page, code) {
  await page.getByRole("textbox", { name: "代码编辑器", exact: true }).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
  await page.keyboard.press("Escape");
}
async function testAll(page) {
  await page.getByRole("button", { name: /^测试全部/ }).click();
  await page.getByText("全部通过", { exact: true }).or(page.getByText("有用例未通过", { exact: true })).first().waitFor({ timeout: 90000 });
}
try {
  // 1) 登录了：通过 → 记一条，并显示另存的题解和新状态；题解区重新读一遍
  {
    const { context, page, errors, records, solutions } = await open();
    await language(page, "Python");
    await writeCode(page, spec.codes[0].code);
    const before = solutions.count;
    await testAll(page);
    const line = page.getByTestId("practice-record");
    await line.getByText("查看提交").waitFor();
    const text = await line.innerText();
    assert.match(text, /已记进进度仓：尝试记录 2026-11-17\.1\.通过\.md，题解另存为 0015\.三数之和\.py，状态改成「已通过」/);
    assert.equal(records.length, 1);
    const r = records[0];
    assert.equal(r.id, 15); assert.equal(r.language, "python"); assert.equal(r.mode, "leetcode"); assert.equal(r.result, "通过");
    assert.equal(r.passed, r.total); assert(r.total > 10, "测试全部跑的是全部用例");
    assert.equal(r.code.trim(), spec.codes[0].code.trim(), "代码原样交给服务端");
    assert.deepEqual(r.failures, []);
    for (let i = 0; i < 50 && solutions.count === before; i++) await page.waitForTimeout(100);
    assert(solutions.count > before, "记完之后重新读「我的题解 / 尝试记录」");
    if (process.env.PRACTICE_SCREENSHOT_DIR) await page.locator("#practice").screenshot({ path: path.join(process.env.PRACTICE_SCREENSHOT_DIR, "record-saved.png") });
    console.log("✓ 通过：记进进度仓，显示尝试记录、另存的题解和新状态，题解区重新读取");

    // 2) 答案错误：记下没通过的用例（最多 3 组），不提题解
    await language(page, "JavaScript");
    await writeCode(page, "var threeSum = function(nums) {\n  return nums.length > 3 ? [] : [[0, 0, 0]];\n};");
    await testAll(page);
    await page.getByTestId("practice-record").getByText("查看提交").waitFor();
    const wa = records.at(-1);
    assert.equal(wa.result, "答案错误"); assert.equal(wa.language, "javascript");
    assert(wa.passed < wa.total);
    assert(wa.failures.length >= 1 && wa.failures.length <= 3);
    for (const f of wa.failures) for (const k of ["label", "input", "expected", "actual"]) assert.equal(typeof f[k], "string", k);
    assert.match(wa.failures[0].input, /nums = /, "输入按题面格式写");
    assert.doesNotMatch(await page.getByTestId("practice-record").innerText(), /题解另存为/);
    console.log("✓ 答案错误：带上没通过的用例");

    // 3) 运行出错
    await writeCode(page, "var threeSum = function(nums) {\n  return nums.missing.length;\n};");
    await testAll(page);
    await page.getByTestId("practice-record").getByText("查看提交").waitFor();
    assert.equal(records.at(-1).result, "运行出错");
    assert.match(records.at(-1).failures[0].error, /Cannot read properties of undefined/);
    console.log("✓ 运行出错：带上错误信息");

    // 4) 只跑示例不记；关掉开关后「测试全部」也不记，开关记在浏览器里
    const n = records.length;
    await page.getByRole("button", { name: "运行示例", exact: true }).click();
    await page.getByText("有用例未通过", { exact: true }).or(page.getByText("全部通过", { exact: true })).first().waitFor({ timeout: 90000 });
    await page.locator(".practice-run-controls").getByText("记进进度仓", { exact: true }).click(); // 真正的 input 是隐藏的，用户点的是开关和文字
    assert.equal(await page.getByRole("switch", { name: "记进进度仓" }).isChecked(), false);
    await testAll(page);
    await page.waitForTimeout(500);
    assert.equal(records.length, n, "运行示例和关掉开关后都不记");
    assert.equal(await page.getByTestId("practice-record").count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem("hot100:practice:record")), "off");
    await page.reload();
    await page.getByRole("switch", { name: "记进进度仓" }).waitFor();
    assert.equal(await page.getByRole("switch", { name: "记进进度仓" }).isChecked(), false, "刷新后开关还是关着");
    console.log("✓ 运行示例不记；关掉开关不记，刷新后仍然关着");
    assert.deepEqual(errors, []);
    await context.close();
  }

  // 5) 服务端拒绝（比如进度仓一直在变）：显示原因，运行结果照常
  {
    const { context, page, errors, records } = await open({ reply: () => [{ error: "进度仓一直在变，稍后再试" }, 409] });
    await language(page, "JavaScript");
    await writeCode(page, spec.codes[0].langs.javascript.code);
    await testAll(page);
    await page.getByTestId("practice-record").getByText(/没记进进度仓：进度仓一直在变，稍后再试/).waitFor();
    assert.equal(records.length, 1);
    await page.getByText("全部通过", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log("✓ 记录失败时显示原因，不影响运行结果");
    await context.close();
  }

  // 6) 没登录：没有开关，也不发请求
  {
    const { context, page, errors, records } = await open({ user: false });
    await language(page, "JavaScript");
    await writeCode(page, spec.codes[0].langs.javascript.code);
    await testAll(page);
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole("switch", { name: "记进进度仓" }).count(), 0);
    assert.equal(records.length, 0);
    assert.deepEqual(errors, []);
    console.log("✓ 没登录时不显示开关、不记录");
    await context.close();
  }
  console.log("Practice record browser checks passed.");
} finally {
  await browser.close();
}
