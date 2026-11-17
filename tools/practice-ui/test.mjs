// Real-browser regression checks against a running local preview.
// Run from the repository root: node tools/practice-ui/test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const screenshots = process.env.PRACTICE_SCREENSHOT_DIR || path.join(os.tmpdir(), "leetcode-practice-ui");
const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const spec = JSON.parse(await fs.readFile(path.join(root, "tools/illustrations/data/0015.json"), "utf8"));
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, colorScheme: "light" });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error" && process.env.PRACTICE_TRACE_RESOURCES) console.error("Browser console:", message.text()); });
context.on("requestfailed", (request) => { if (request.url().includes("/practice-runtime/") && request.failure()?.errorText !== "net::ERR_ABORTED") console.error("Runtime resource:", request.url(), request.failure()?.errorText); });
if (process.env.PRACTICE_TRACE_RESOURCES) context.on("response", (response) => { if (response.url().includes("/practice-runtime/")) console.log("Runtime response:", response.status(), response.url()); });

async function waitEditor() {
  await page.getByRole("textbox", { name: "代码编辑器", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector(".cm-content")?.getAttribute("contenteditable") === "true");
}
async function writeCode(code) {
  const editor = page.getByRole("textbox", { name: "代码编辑器", exact: true });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(code);
  await page.keyboard.press("Escape");
  await page.waitForFunction((value) => document.querySelector(".cm-content")?.textContent?.includes(value), code.split("\n")[0]);
}
async function language(name) {
  await page.locator('.practice-editor-toolbar button[aria-label="练习语言"]').click();
  await page.getByRole("option", { name, exact: true }).click();
  await waitEditor();
  await page.waitForFunction((name) => document.querySelector('[data-slot="select-value"]')?.textContent?.includes(name), name);
}
async function mode(name) {
  await page.getByLabel("编程模式", { exact: true }).getByRole("radio", { name, exact: true }).click();
  await waitEditor();
}
async function run(all = false) {
  await page.getByRole("button", { name: all ? /^测试全部/ : "运行示例", exact: !all }).click();
  const verdict = page.getByText("全部通过", { exact: true }).or(page.getByText("有用例未通过", { exact: true }));
  await verdict.first().waitFor({ timeout: 90000 });
  assert.equal(await page.getByText("有用例未通过", { exact: true }).count(), 0, await page.locator("#practice").innerText());
}
const jsAlgorithm = `function solve(nums) {
  nums.sort((a, b) => a - b);
  const answer = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i && nums[i] === nums[i - 1]) continue;
    let left = i + 1, right = nums.length - 1;
    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];
      if (sum < 0) left++;
      else if (sum > 0) right--;
      else {
        answer.push([nums[i], nums[left], nums[right]]);
        const a = nums[left], b = nums[right];
        while (left < right && nums[left] === a) left++;
        while (left < right && nums[right] === b) right--;
      }
    }
  }
  return answer;
}`;
const acmJs = `${jsAlgorithm}
const tokens = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
const count = tokens.shift();
const answer = solve(tokens.slice(0, count));
console.log([answer.length, ...answer.flatMap(row => [row.length, row.join(" ")])].join("\\n"));`;
const acmPython = `import sys
values = list(map(int, sys.stdin.read().split()))
nums = sorted(values[1:values[0] + 1])
answer = []
for i in range(len(nums) - 2):
    if i and nums[i] == nums[i - 1]:
        continue
    left, right = i + 1, len(nums) - 1
    while left < right:
        total = nums[i] + nums[left] + nums[right]
        if total < 0:
            left += 1
        elif total > 0:
            right -= 1
        else:
            answer.append([nums[i], nums[left], nums[right]])
            a, b = nums[left], nums[right]
            while left < right and nums[left] == a:
                left += 1
            while left < right and nums[right] == b:
                right -= 1
print(len(answer))
for row in answer:
    print(len(row))
    print(*row)
`;

try {
  await fs.mkdir(screenshots, { recursive: true });
  await page.goto(`${base}/p/15/`);
  await waitEditor();
  await mode("LeetCode");

  if (!process.env.PRACTICE_UI_ONLY) {
  for (const [id, name] of [["javascript", "JavaScript"], ["typescript", "TypeScript"], ["python", "Python"]]) {
    await language(name);
    await writeCode(id === "python" ? spec.codes[0].code : spec.codes[0].langs[id].code);
    await run(true);
    console.log(`✓ LeetCode ${name}: full local cases`);
  }
  await language("JavaScript");
  const marker = "// draft-isolation-check";
  const savedCode = `${spec.codes[0].langs.javascript.code}\n${marker}`;
  await writeCode(savedCode);
  await language("Python");
  await language("JavaScript");
  assert((await page.locator(".cm-content").innerText()).includes(marker), "Switching language must preserve its draft");
  await page.reload();
  await waitEditor();
  assert((await page.locator(".cm-content").innerText()).includes(marker), "Reload must recover the correct draft");

  await mode("ACM");
  await page.getByRole("heading", { name: "输入格式", exact: true }).waitFor();
  for (const [name, code] of [["JavaScript", acmJs], ["TypeScript", acmJs.replace("function solve(nums)", "function solve(nums: number[])")], ["Python", acmPython]]) {
    await language(name);
    await writeCode(code);
    await run(true);
    console.log(`✓ ACM ${name}: real stdin/stdout`);
  }
  await language("JavaScript");
  await writeCode('console.log("free-form-output-fixture");');
  await page.getByRole("button", { name: "运行示例", exact: true }).click();
  await page.getByTestId("practice-test-panel").waitFor();
  await page.getByRole("button", { name: "运行示例", exact: true }).waitFor();
  await page.getByRole("radio", { name: "自定义", exact: true }).click();
  await page.getByRole("textbox", { name: "自定义预期结果", exact: true }).fill("");
  await page.getByRole("button", { name: "运行自定义", exact: true }).click();
  await page.getByText("未设置预期，仅运行", { exact: true }).waitFor();
  assert((await page.locator("#practice").innerText()).includes("free-form-output-fixture"));
  assert.equal(await page.getByText("有用例未通过", { exact: true }).count(), 0);
  console.log("✓ ACM custom input without an expected result permits free-form stdout");
  await mode("LeetCode");
  await language("JavaScript");
  assert((await page.locator(".cm-content").innerText()).includes(marker), "Switching mode must preserve its separate draft");

  await page.getByRole("link", { name: "题目列表", exact: true }).click();
  await page.locator('a[href="/p/1/"]').first().click();
  await waitEditor();
  assert(!(await page.locator(".cm-content").innerText()).includes(marker), "Different problems must use different drafts");
  await writeCode("// problem-one-draft\nfunction twoSum(nums, target) { return []; }");
  await page.goto(`${base}/p/15/`);
  await waitEditor();
  assert((await page.locator(".cm-content").innerText()).includes(marker), "Returning to a problem must restore its draft");
  console.log("✓ Drafts survive reload and are separate by problem, mode and language");

  await writeCode("function threeSum(nums) { return []; }");
  await page.getByRole("button", { name: "运行示例", exact: true }).click();
  await page.getByText("有用例未通过", { exact: true }).waitFor();
  console.log("✓ Wrong answer is reported");

  await writeCode("function threeSum( {");
  await page.getByRole("button", { name: "运行示例", exact: true }).click();
  await page.getByText("有用例未通过", { exact: true }).waitFor();
  assert(await page.locator("#practice").getByText(/SyntaxError|Unexpected|语法/).count(), "Syntax errors must be shown");
  console.log("✓ Syntax error is reported");

  await writeCode("function threeSum(nums) { while (true) {} }");
  await page.getByRole("button", { name: "运行示例", exact: true }).click();
  await page.getByRole("button", { name: "停止运行", exact: true }).click();
  await page.getByText("已停止", { exact: true }).waitFor();
  await page.getByRole("button", { name: "运行示例", exact: true }).click();
  await page.getByText(/运行超时/).waitFor({ timeout: 20000 });
  console.log("✓ Stop and timeout keep the editor responsive");

  await writeCode(`${spec.codes[0].langs.javascript.code}\nconsole.log("debug-fixture");`);
  await page.getByRole("button", { name: "运行示例", exact: true }).click();
  await page.getByText("全部通过", { exact: true }).waitFor();
  await page.getByText("标准输出 / 调试信息", { exact: true }).waitFor();
  assert((await page.locator("#practice").innerText()).includes("debug-fixture"));

  await page.getByRole("radio", { name: "自定义", exact: true }).click();
  await page.getByRole("textbox", { name: "自定义参数 nums", exact: true }).fill("[-1, 0, 1, 2, -1, -4]");
  await page.getByRole("textbox", { name: "自定义预期结果", exact: true }).fill("");
  await page.getByRole("button", { name: "运行自定义", exact: true }).click();
  await page.getByText("未设置预期，仅运行", { exact: true }).waitFor();
  assert.equal(await page.getByText("全部通过", { exact: true }).count(), 0, "Unchecked custom cases must not claim acceptance");
  console.log("✓ Console output and unchecked custom input");
  } else {
    await language("JavaScript");
    await writeCode(`${spec.codes[0].langs.javascript.code}\nconsole.log("debug-fixture");`);
    await run();
  }

  await page.locator("#practice").getByRole("button", { name: "重置代码", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  assert((await page.locator(".cm-content").innerText()).includes("debug-fixture"));
  await page.locator("#practice").getByRole("button", { name: "重置代码", exact: true }).click();
  await page.getByRole("button", { name: "确认重置", exact: true }).click();
  await page.waitForFunction(() => { const t = document.querySelector(".cm-content")?.textContent || ""; return !t.includes("debug-fixture") && t.includes("threeSum"); });
  console.log("✓ Reset requires explicit confirmation");

  await writeCode(spec.codes[0].langs.javascript.code);
  await page.getByRole("textbox", { name: "代码编辑器", exact: true }).press("ControlOrMeta+Enter");
  await page.getByText("全部通过", { exact: true }).waitFor();
  console.log("✓ Keyboard shortcut runs once");

  // 编辑器提示程度：用真实按键验证（整段插入文字会绕过回车缩进和括号配对）。
  // 两档都有语法颜色、括号配对、自动缩进；「无提示」只补全代码里已有的变量，不提示内置函数、关键字
  const hintLevel = async (pattern) => {
    await page.locator('.practice-editor-toolbar button[aria-label="编辑器提示"]').click();
    await page.getByRole("option", { name: pattern }).click();
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'));
  };
  const typeAfter = async (head, keys) => {
    await writeCode(head);
    await page.getByRole("textbox", { name: "代码编辑器", exact: true }).click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type(keys);
    await page.waitForTimeout(500);
    return page.evaluate(() => {
      const e = document.querySelector(".cm-content"), v = e.cmTile?.root?.view || e.cmView?.view;
      return { doc: v.state.doc.toString(), options: [...document.querySelectorAll(".cm-tooltip-autocomplete .cm-completionLabel")].map((n) => n.textContent), colored: e.querySelectorAll(".cm-line span").length };
    });
  };
  await language("Python");
  await hintLevel(/^无提示/);
  const local = await typeAfter("def f():\n    total = 1", "tot");
  assert(local.options.includes("total"), `No hints still completes existing variables (${local.options})`);
  await page.keyboard.press("Escape");
  const builtin = await typeAfter("def f():\n    total = 1", "pri");
  assert(!builtin.options.includes("print"), `No hints must not suggest builtins (${builtin.options})`);
  await page.keyboard.press("Escape");
  const paired = await typeAfter("def f():", "x = (");
  assert.equal(paired.doc, "def f():\n    x = ()", "No hints keeps auto-indent and bracket pairing");
  assert(paired.colored > 0, "No hints keeps syntax colors");
  await hintLevel(/^完整提示/);
  const full = await typeAfter("def f():", "pri");
  assert(full.options.includes("print"), `Full hints suggest builtins (${full.options})`);
  await page.keyboard.press("Escape");
  console.log("✓ Editor hints: full suggests builtins; no-hints only completes existing variables, keeping colors, pairing and indentation");

  // 桌面：正文和练习区之间的竖条拖动调整练习区宽度，记在浏览器里（刷新不跳），方向键也能调，双击恢复默认，收起时不显示
  {
    const handle = page.getByRole("separator", { name: "调整练习区宽度", exact: true });
    const practiceWidth = () => page.locator(".practice-sidebar").evaluate((el) => el.getBoundingClientRect().width);
    const bodyWidth = () => page.locator(".problem-original").evaluate((el) => el.getBoundingClientRect().width);
    const settle = () => page.waitForTimeout(450); // 列宽有 320ms 的过渡
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await practiceWidth(), bodyBefore = await bodyWidth();
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 - 160, hb.y + hb.height / 2, { steps: 8 });
    await page.mouse.up();
    const wider = await practiceWidth();
    assert(Math.abs(wider - before - 160) < 6, `Dragging the divider left widens practice by the drag distance (${before} → ${wider})`);
    assert(Math.abs(bodyBefore - (await bodyWidth()) - 160) < 6, "…and the problem body gives up the same width");
    await page.mouse.move(hb.x + hb.width / 2 - 160, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x - 2000, hb.y + hb.height / 2, { steps: 4 });
    await page.mouse.up();
    assert((await bodyWidth()) >= 559, `The problem body keeps at least 560px (${await bodyWidth()})`);
    await handle.dblclick();
    await settle();
    assert(Math.abs((await practiceWidth()) - before) < 2, "Double-click restores the default width");
    await handle.focus();
    await page.keyboard.press("ArrowLeft");
    await settle();
    const keyed = await practiceWidth();
    assert(keyed > before + 20, `Arrow keys resize too (${before} → ${keyed})`);
    await page.reload();
    await waitEditor();
    assert(Math.abs((await practiceWidth()) - keyed) < 2, "Practice width survives reload without jumping");
    await page.getByRole("button", { name: "收起练习区", exact: true }).click();
    await settle();
    assert.equal(await handle.isVisible(), false, "Divider hides when practice is stowed");
    await page.getByRole("button", { name: "展开练习区", exact: true }).click();
    await settle();
    assert(Math.abs((await practiceWidth()) - keyed) < 2, "Summoning practice brings back the chosen width");
    await handle.dblclick();
    await settle();
    console.log("✓ Desktop divider: drag, min body width, keys, double-click reset, survives reload, hidden when stowed");
  }

  // 桌面上练习区钉在顶栏下面：滚到页面最底下也不被页脚顶上去，页脚的字不被它盖住
  {
    const sidebarY = async () => (await page.locator(".practice-sidebar").boundingBox()).y;
    assert(Math.abs((await sidebarY()) - 80) < 2, "Docked practice sits under the header");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    assert(Math.abs((await sidebarY()) - 80) < 2, "…and stays there at the very bottom of the page");
    const footerText = await page.locator("body > footer").evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().right; });
    assert(footerText < (await page.locator(".practice-sidebar").boundingBox()).x, "Footer text stays clear of the fixed practice area");
    await page.evaluate(() => window.scrollTo(0, 0));
    console.log("✓ Docked practice stays fixed under the header, even at the bottom; footer text not covered");
  }

  // 断点：点行号、点行号左边那一栏、F9 都能切换；长行默认折行，可以关掉，记在浏览器里
  {
    await language("Python");
    await writeCode("class Solution:\n    def threeSum(self, nums):\n        out = []\n        nums.sort()\n        return out  # " + "x".repeat(160));
    const dots = async () => (await page.locator(".cm-breakpoint-gutter .cm-breakpoint-dot").count()) - 1; // 减去撑宽度用的占位
    const order = await page.evaluate(() => [...document.querySelectorAll(".cm-gutters > .cm-gutter")].map((g) => g.classList[1]));
    assert.deepEqual(order.slice(0, 2), ["cm-breakpoint-gutter", "cm-lineNumbers"], `Breakpoint column is left of the line numbers (${order})`);
    await page.locator(".cm-lineNumbers .cm-gutterElement", { hasText: /^3$/ }).click();
    assert.equal(await dots(), 1, "Clicking a line number adds a breakpoint");
    await page.locator(".cm-lineNumbers .cm-gutterElement", { hasText: /^3$/ }).click();
    assert.equal(await dots(), 0, "Clicking it again removes it");
    const g = await page.locator(".cm-breakpoint-gutter").boundingBox(), l4 = await page.locator(".cm-lineNumbers .cm-gutterElement", { hasText: /^4$/ }).boundingBox();
    await page.mouse.click(g.x + g.width / 2, l4.y + l4.height / 2);
    assert.equal(await dots(), 1, "Clicking the column left of the numbers adds one");
    await page.locator(".cm-line").nth(4).click();
    await page.keyboard.press("F9");
    assert.equal(await dots(), 2, "F9 toggles the cursor line");
    // 折成几行的长行（第 5 行，刚才按 F9 加的）：圆点和行号在同一行，不跑到中间
    const aligned = await page.evaluate(() => {
      const num = [...document.querySelectorAll(".cm-lineNumbers .cm-gutterElement")].find((e) => e.textContent === "5").getBoundingClientRect();
      const dot = [...document.querySelectorAll(".cm-breakpoint-gutter .cm-gutterElement")].filter((c) => c.style.visibility !== "hidden").map((c) => c.querySelector(".cm-breakpoint-dot")).filter(Boolean).map((d) => d.getBoundingClientRect()).find((r) => r.y >= num.y - 1 && r.y < num.bottom);
      return { wrapped: num.height > 30, dy: Math.abs(dot.y + dot.height / 2 - (num.y + 13)) };
    });
    assert(aligned.wrapped && aligned.dy < 2, `Breakpoint dot sits on the line-number row of a wrapped line (${JSON.stringify(aligned)})`);
    const gutters = await page.locator(".cm-gutters").boundingBox();
    assert(gutters.width <= 56, `Gutters stay narrow (${gutters.width}px)`);
    const scroller = page.locator(".practice-editor .cm-scroller");
    const overflows = () => scroller.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    const wrapButton = page.getByRole("button", { name: "自动换行", exact: true });
    assert.equal(await wrapButton.getAttribute("aria-pressed"), "true", "Wrapping is on by default");
    assert.equal(await overflows(), false, "Long lines wrap by default");
    await wrapButton.click();
    assert.equal(await overflows(), true, "Turning wrapping off scrolls long lines sideways");
    await page.reload();
    await waitEditor();
    assert.equal(await page.getByRole("button", { name: "自动换行", exact: true }).getAttribute("aria-pressed"), "false", "Wrap choice survives reload");
    await page.getByRole("button", { name: "自动换行", exact: true }).click();
    await mode("LeetCode");
    console.log("✓ Breakpoints: line numbers, column and F9; long lines wrap by default and can be switched off");
  }

  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await page.locator(".practice-shell--focus").waitFor();
  // 专注模式是一整块铺满屏幕的工作区：没有外框，代码卡片也不再套边框
  await page.waitForTimeout(300);
  const shellBox = await page.locator(".practice-shell--focus").boundingBox();
  assert(shellBox.x === 0 && shellBox.y === 0 && Math.abs(shellBox.width - page.viewportSize().width) < 1, `Focus mode fills the screen without an outer frame (${JSON.stringify(shellBox)})`);
  assert.equal(await page.locator("#practice").evaluate((el) => getComputedStyle(el).borderTopWidth + " " + getComputedStyle(el).borderTopLeftRadius), "0px 0px", "Code card has no border or rounded corners in focus mode");
  await page.screenshot({ path: path.join(screenshots, "desktop-focus.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await page.locator(".practice-shell--focus").waitFor({ state: "detached" });
  await page.locator(".cm-scroller").evaluate((element) => { element.scrollTop = 0; element.scrollLeft = 0; });
  assert.equal(await page.locator(".practice-shell--focus").count(), 0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(screenshots, "desktop-light.png"), animations: "disabled" });
  await page.getByRole("button", { name: /点一下切到深色/ }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await page.screenshot({ path: path.join(screenshots, "desktop-dark.png"), animations: "disabled" });
  // 手机：页面里不放编辑器，底部常驻「写代码」；点开是全屏的题面 + 编辑器，题面可以收起、展开、只看题目
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile layout must not overflow horizontally");
  assert.equal(await page.locator(".practice-sidebar").isVisible(), false, "Mobile page keeps the editor out of the page flow");
  const launch = page.getByRole("button", { name: "写代码", exact: true });
  await launch.click();
  await page.locator(".practice-shell--focus").waitFor();
  await page.locator(".practice-shell").screenshot({ path: path.join(screenshots, "mobile-dark.png"), animations: "disabled" });
  const box = (selector) => page.locator(selector).boundingBox();
  const [statementBox, editorBox] = [await box(".practice-focus-statement"), await box(".practice-editor-column")];
  assert(editorBox.y >= statementBox.y + statementBox.height - 1 && statementBox.x >= 0 && editorBox.x + editorBox.width <= 391, "Mobile workspace stacks statement above code inside the screen");
  await page.getByRole("button", { name: "收起题目", exact: true }).click();
  assert.equal(await page.locator(".practice-focus-statement-body").isVisible(), false, "Folding hides the statement body");
  assert((await box(".cm-editor")).height > editorBox.height * 0.5, "Folding leaves the editor usable");
  await page.getByRole("button", { name: "展开题目", exact: true }).click();
  await page.getByRole("button", { name: "只看题目", exact: true }).click();
  assert.equal(await page.locator("#practice").isVisible(), false, "Statement-only view hides the code card");
  assert(await page.getByRole("button", { name: "退出专注模式", exact: true }).isVisible(), "Exit stays reachable in statement-only view");
  await page.getByRole("button", { name: "返回代码", exact: true }).click();
  assert(await page.locator("#practice").isVisible(), "Back to code shows the editor again");
  await page.keyboard.press("Escape");
  await page.locator(".practice-shell--focus").waitFor({ state: "detached" });
  assert(await launch.isVisible(), "Launcher returns after leaving the workspace");
  console.log("✓ Focus, Escape, light/dark themes and mobile workspace (launcher, fold, statement-only)");
  assert.deepEqual(errors, [], "No unhandled browser errors");
  console.log(`Practice UI browser checks passed. Screenshots: ${screenshots}`);
} catch (error) {
  await page.screenshot({ path: path.join(screenshots, "failure.png"), fullPage: true }).catch(() => {});
  console.error("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
}
