// Real-input visual regression for the user's VS Code reference and focus exit.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../site/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const base = process.env.PRACTICE_BASE_URL || "http://127.0.0.1:8788";
const output = process.env.PRACTICE_REFINEMENT_SCREENSHOTS || path.join(os.tmpdir(), "leetcode-editor-refinement");
const frameDirectory = path.join(output, `exit-frames-${Date.now()}`);
const source = `class ListNode:
    def __init__(self, val = 0, next = None):
        self.val = val
        self.next = next

def merge_sort(node):
    if node is None or node.next is None:
        return node

    slow = node
    fast = node.next

    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next

    right = slow.next
    slow.next = None

    left = merge_sort(node)
    right = merge_sort(right)

    head = ListNode()
    tail = head

    while left is not None and right is not None:
        if left.val <= right.val:
            tail.next = left
            left = left.next
        else:
            tail.next = right
            right = right.next
        tail = tail.next
    tail.next = left if left else right
    return head.next
`;
await fs.mkdir(frameDirectory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "light", reducedMotion: "no-preference" });
await context.addInitScript(() => { if (window === window.top) { localStorage.setItem("theme", "light"); localStorage.setItem("hot100:practice:options", JSON.stringify({ mode: "acm", language: "python" })); } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const cm = () => page.getByRole("textbox", { name: "代码编辑器", exact: true });
const phase = (expected) => page.waitForFunction((value) => document.querySelector(".practice-sidebar")?.dataset.focusPhase === value, expected);
async function dragSelection() {
  await page.evaluate(() => { const element = document.querySelector(".cm-content"), view = element.cmTile?.root?.view || element.cmView?.view; view.scrollDOM.scrollTop = 0; });
  const points = await page.evaluate(() => {
    const element = document.querySelector(".cm-content"), view = element.cmTile?.root?.view || element.cmView?.view, line = view.state.doc.line(13);
    const a = view.coordsAtPos(line.from + 7), b = view.coordsAtPos(line.from + 44);
    return { a: { x: a.left, y: (a.top + a.bottom) / 2 }, b: { x: b.left, y: (b.top + b.bottom) / 2 } };
  });
  await page.mouse.move(points.a.x, points.a.y); await page.mouse.down(); await page.mouse.move(points.b.x, points.b.y, { steps: 15 }); await page.mouse.up();
  await page.waitForFunction(() => !!document.querySelector(".cm-selectionBackground"));
  return page.evaluate(() => {
    const element = document.querySelector(".cm-content"), view = element.cmTile?.root?.view || element.cmView?.view;
    return { selected: view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to), rectangles: [...document.querySelectorAll(".cm-selectionBackground")].map((node) => ({ background: getComputedStyle(node).backgroundColor, radius: getComputedStyle(node).borderRadius, shadow: getComputedStyle(node).boxShadow })), font: getComputedStyle(element).fontSize, lineHeight: getComputedStyle(element).lineHeight, guides: document.querySelectorAll(".cm-indent-guides").length };
  });
}
try {
  await page.goto(`${base}/p/148/`); await cm().waitFor();
  await page.waitForFunction(() => document.querySelector(".cm-content")?.contentEditable === "true");
  await cm().click(); await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.insertText(source); await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  const report = {};
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") { await page.getByRole("button", { name: /点一下切到深色/ }).click(); await page.waitForFunction(() => document.documentElement.classList.contains("dark")); }
    report[theme] = await dragSelection();
    report[theme].backgrounds = await page.evaluate(() => [".cm-editor", ".cm-gutters"].map((selector) => getComputedStyle(document.querySelector(selector)).backgroundColor));
    report[theme].constructors = await page.locator(".cm-class-reference").evaluateAll((nodes) => nodes.map((node) => { const token = node.querySelector("span") || node; return { text: token.textContent, color: getComputedStyle(token).color, weight: getComputedStyle(token).fontWeight }; }));
    assert(report[theme].selected.length > 10); assert.equal(report[theme].font, "15px"); assert.equal(report[theme].lineHeight, "26px"); assert(report[theme].guides > 5);
    assert(report[theme].rectangles.every((rectangle) => rectangle.background !== "rgba(0, 0, 0, 0)" && rectangle.radius === "3px" && rectangle.shadow !== "none"));
    assert(report[theme].constructors.some((token) => token.text === "ListNode" && token.color === (theme === "light" ? "rgb(132, 51, 175)" : "rgb(198, 160, 229)") && Number(token.weight) >= 600), "Constructor calls retain the reference class color and weight");
    assert(report[theme].backgrounds.every((color) => color === (theme === "light" ? "rgb(255, 255, 255)" : "rgb(32, 33, 36)")), "Editor and gutter use the selected theme canvas");
    assert.equal(await page.locator(".cm-activeLine").count(), 0);
    await page.screenshot({ path: path.join(output, `${theme}-reference-selection.png`) });
  }
  await page.getByRole("button", { name: /点一下切到浅色/ }).click();
  await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
  await page.getByRole("button", { name: "进入专注模式", exact: true }).click(); await phase("open"); await page.waitForTimeout(280);
  await dragSelection(); await page.screenshot({ path: path.join(output, "focus-reference.png") });
  await page.evaluate(() => {
    const element = document.querySelector(".cm-content"), view = element.cmTile?.root?.view || element.cmView?.view;
    window.__exitBefore = { element, view, selection: view.state.selection.main.toJSON(), doc: view.state.doc.toString() };
    window.__exitFrames = [];
    function frame(time) {
      const saved = window.__exitBefore, element = document.querySelector(".cm-content"), view = element.cmTile?.root?.view || element.cmView?.view, column = document.querySelector(".practice-editor-column"), r = column.getBoundingClientRect();
      let opacity = 1;
      for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
      const left = document.querySelector(".practice-focus-statement"), shell = document.querySelector(".practice-sidebar"), original = document.querySelector(".problem-original"), l = left.getBoundingClientRect();
      const effectiveOpacity = (node) => {
        let value = 1;
        for (; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") return 0;
          value *= Number(style.opacity);
        }
        return value;
      };
      const animations = shell.getAnimations().map((animation) => ({ startTime: animation.startTime, duration: animation.effect.getTiming().duration, easing: getComputedStyle(shell).animationTimingFunction, progress: animation.effect.getComputedTiming().progress }));
      window.__exitFrames.push({ time, phase: document.querySelector(".practice-sidebar").dataset.focusPhase, opacity, x: r.x, y: r.y, width: r.width, height: r.height, left: { x: l.x, y: l.y, width: l.width, height: l.height, opacity: effectiveOpacity(left) }, originalOpacity: effectiveOpacity(original), animations, same: element === saved.element && view === saved.view, doc: view.state.doc.toString() === saved.doc });
      if (window.__exitFrames.length < 150 && (window.__exitFrames.length < 3 || document.querySelector(".practice-sidebar").dataset.focusPhase !== "closed")) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
  const cdp = await context.newCDPSession(page), pending = [];
  let frameIndex = 0;
  cdp.on("Page.screencastFrame", (frame) => { pending.push(fs.writeFile(path.join(frameDirectory, `${String(frameIndex++).padStart(3, "0")}.png`), Buffer.from(frame.data, "base64"))); void cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {}); });
  await cdp.send("Page.startScreencast", { format: "png", maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await page.getByRole("button", { name: "退出专注模式", exact: true }).click(); await phase("closed"); await page.waitForTimeout(100);
  await cdp.send("Page.stopScreencast"); await Promise.all(pending);
  report.exit = await page.evaluate(() => window.__exitFrames);
  report.frameDirectory = frameDirectory;
  assert(report.exit.some((frame) => frame.phase === "closing"), "The shared closing animation must have visible frames");
  assert(report.exit.every((frame) => frame.same && frame.doc && frame.width > 0 && frame.height > 0), "The same editor stays mounted and populated through the shared fade");
  assert(report.exit.every((frame) => !(frame.left.opacity > 0 && frame.originalOpacity > 0)), "Never show both copies of the statement text in one frame");
  assert(report.exit.some((frame) => frame.left.opacity > 0) && report.exit.some((frame) => frame.originalOpacity === 1), "The hand-off must restore the actual original statement");
  for (const frame of report.exit.filter((value) => value.phase === "closing")) {
    assert(frame.left.width > 0 && frame.left.height > 0, "The statement remains mounted through the shared transition");
    assert.equal(frame.animations.length, 1);
    assert.equal(frame.animations[0].duration, 60);
    assert.equal(frame.animations[0].easing, "linear");
    assert(Math.abs(frame.left.opacity - frame.opacity) < 0.0001, "Both panels fade together through their one parent animation");
  }
  assert.equal(await page.evaluate(() => { const element = document.querySelector(".cm-content"); return (element.cmTile?.root?.view || element.cmView?.view).state.doc.toString(); }), source);
  await page.screenshot({ path: path.join(output, "normal-returned.png") });
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  console.log(`Passed real mouse selection, reference theme/guides, and ${report.exit.length} shared exit animation frames without duplicate statements. Screenshots: ${output}`);
} catch (error) { await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {}); throw error; }
finally { await browser.close(); }
