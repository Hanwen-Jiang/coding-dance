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
  await page.waitForFunction(() => document.querySelector(".cm-content")?.textContent?.includes("请完成解法"));
  console.log("✓ Reset requires explicit confirmation");

  await writeCode(spec.codes[0].langs.javascript.code);
  await page.getByRole("textbox", { name: "代码编辑器", exact: true }).press("ControlOrMeta+Enter");
  await page.getByText("全部通过", { exact: true }).waitFor();
  console.log("✓ Keyboard shortcut runs once");

  await page.getByRole("button", { name: "进入专注模式", exact: true }).click();
  await page.locator(".practice-shell--focus").waitFor();
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".practice-shell").screenshot({ path: path.join(screenshots, "mobile-dark.png"), animations: "disabled" });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile layout must not overflow horizontally");
  console.log("✓ Focus, Escape, light/dark themes and mobile layout");
  assert.deepEqual(errors, [], "No unhandled browser errors");
  console.log(`Practice UI browser checks passed. Screenshots: ${screenshots}`);
} catch (error) {
  await page.screenshot({ path: path.join(screenshots, "failure.png"), fullPage: true }).catch(() => {});
  console.error("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
}
