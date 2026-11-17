// Focused CodeMirror indentation regression; no problem data or judge algorithms run.
// node tools/practice-runtime/indent-guides.test.mjs [--browser]
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../site/package.json", import.meta.url));
const ts = require("typescript");
const { EditorState, Compartment } = require("@uiw/react-codemirror");
const { indentUnit } = require("@codemirror/language");
const source = await fs.readFile(path.join(root, "site/components/practice/editor-guides.ts"), "utf8");
const module = { exports: {} };
new Function("require", "module", "exports", ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(require, module, module.exports);
const extension = module.exports.practiceIndentGuides;

function state(doc, unit = "    ", tabSize = 4) {
  return EditorState.create({ doc, selection: { anchor: Math.min(3, doc.length) }, extensions: [indentUnit.of(unit), EditorState.tabSize.of(tabSize)] });
}
function view(editorState, first = 1, last = editorState.doc.lines) {
  return { state: editorState, visibleRanges: [{ from: editorState.doc.line(first).from, to: editorState.doc.line(last).to }] };
}
function lines(plugin, editorState) {
  const found = [];
  plugin.decorations.between(0, editorState.doc.length, (from, to, value) => {
    const attrs = value.spec.attributes;
    if (attrs?.class !== "cm-indent-guides") return;
    assert.equal(from, to, "guides must be line decorations, without added document width");
    assert.equal(value.spec.widget, undefined);
    assert(!/\b(?:padding|margin|border|width|font|letter-spacing)\s*:/.test(attrs.style), "guides must not change caret geometry");
    found.push({ number: editorState.doc.lineAt(from).number, depth: Number(attrs["data-indent-depth"]), style: attrs.style });
  });
  return found;
}

const fixture = "class Example:\n    def value(self):\n        return 1\n\n    done = True\n\ntop_level = 1\n\n";
const sample = state(fixture), selection = sample.selection.toJSON();
const samplePlugin = extension.create(view(sample));
assert.deepEqual(lines(samplePlugin, sample).map(({ number, depth }) => [number, depth]), [[2, 1], [3, 2], [4, 1], [5, 1]]);
assert.match(lines(samplePlugin, sample).find((line) => line.number === 3).style, /background-position:0ch 0,4ch 0/);
assert.equal(sample.doc.toString(), fixture);
assert.deepEqual(sample.selection.toJSON(), selection);

const js = state("function run() {\n  if (ok) {\n    work();\n  }\n}\n", "  ");
assert.deepEqual(lines(extension.create(view(js)), js).map(({ number, depth }) => [number, depth]), [[2, 1], [3, 2], [4, 1]]);
const mixed = state("top\n \t    nested\nend");
assert.equal(lines(extension.create(view(mixed)), mixed)[0].depth, 2, "tabs advance to the next tab stop without editing source");
assert.equal(mixed.doc.line(2).text, " \t    nested");

const tabSize = new Compartment();
const tabs = EditorState.create({ doc: "\t\tnested", extensions: [indentUnit.of("\t"), tabSize.of(EditorState.tabSize.of(4))] });
const tabPlugin = extension.create(view(tabs));
assert.equal(lines(tabPlugin, tabs)[0].depth, 2, "one tab indent unit is tabSize columns, not one column");
assert.match(lines(tabPlugin, tabs)[0].style, /background-position:0ch 0,4ch 0/);
const changedTabs = tabs.update({ effects: tabSize.reconfigure(EditorState.tabSize.of(8)) }).state;
tabPlugin.update({ docChanged: false, viewportChanged: false, startState: tabs, state: changedTabs, view: view(changedTabs) });
assert.equal(lines(tabPlugin, changedTabs)[0].depth, 2);
assert.match(lines(tabPlugin, changedTabs)[0].style, /background-position:0ch 0,8ch 0/);

const large = state(Array.from({ length: 2000 }, (_, n) => `    line_${n}`).join("\n"));
const visible = lines(extension.create(view(large, 900, 909)), large);
assert.deepEqual(visible.map((line) => line.number), Array.from({ length: 10 }, (_, n) => n + 900), "offscreen lines must not get decorations");
const hidden = extension.create({ state: large, visibleRanges: [] });
assert.equal(lines(hidden, large).length, 0);

const whitespace = state("    before\n" + "\n".repeat(10000) + "    after");
let inspected = 0;
const docProxy = new Proxy(whitespace.doc, { get(target, name) {
  if (name === "line") return (...args) => { inspected++; return target.line(...args); };
  const value = Reflect.get(target, name);
  return typeof value === "function" ? value.bind(target) : value;
} });
const stateProxy = new Proxy(whitespace, { get(target, name) {
  if (name === "doc") return docProxy;
  const value = Reflect.get(target, name);
  return typeof value === "function" ? value.bind(target) : value;
} });
const bounded = extension.create({ state: stateProxy, visibleRanges: [{ from: whitespace.doc.line(5000).from, to: whitespace.doc.line(5000).to }] });
assert.equal(lines(bounded, whitespace).length, 0, "distant blocks must not paint a page of empty guides");
assert(inspected > 0 && inspected <= 400, `blank-line context scans must be bounded; inspected ${inspected}`);

console.log("Indent guides: Python/JS levels, tab columns/reconfiguration, internal versus trailing blank lines, viewport bounds, bounded scans, document and selection preservation passed.");

if (process.argv.includes("--browser")) {
  const { chromium } = require("@playwright/test");
  const esbuild = require("esbuild");
  const bundle = await esbuild.build({
    stdin: { resolveDir: path.join(root, "site"), loader: "ts", contents: `
import { EditorState, Compartment } from "@uiw/react-codemirror";
import { EditorView, drawSelection } from "@codemirror/view";
import { indentUnit } from "@codemirror/language";
import { practiceIndentGuides } from "./components/practice/editor-guides";
const guides = new Compartment(), wrapping = new Compartment();
const text = "class Example:\\n    def value(self):\\n        return 1\\n\\n    done = True\\n\\ntop_level = 1\\n        " + "x".repeat(500);
const view = new EditorView({ parent: document.getElementById("host"), state: EditorState.create({ doc: text, extensions: [indentUnit.of("    "), drawSelection(), guides.of(practiceIndentGuides), wrapping.of([]), EditorView.theme({
  "&": { height: "300px", fontSize: "15px", "--practice-indent-guide": "#d9d9d9" },
  ".cm-scroller": { fontFamily: "monospace", lineHeight: "26px" },
  ".cm-content": { padding: "0 0 0 12px" },
  ".cm-line": { padding: "0", lineHeight: "26px" },
})] }) });
window.guideTest = { view, guides, wrapping, text, EditorView, practiceIndentGuides };
` },
    platform: "browser", format: "iife", bundle: true, write: false, logLevel: "silent",
  });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent('<style>body{margin:20px}#host{width:340px;border:1px solid #ddd}</style><div id="host"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const geometry = await page.evaluate(async () => {
      const { view, guides, wrapping, text, EditorView, practiceIndentGuides } = window.guideTest;
      const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await tick();
      const from = view.state.doc.line(3).from;
      view.dispatch({ selection: { anchor: from + 4, head: from + 12 } }); view.focus();
      await tick();
      function measure() {
        const line = [...document.querySelectorAll(".cm-line")][2], rect = line.getBoundingClientRect(), style = getComputedStyle(line);
        const stops = style.backgroundPositionX.split(",").map((n) => parseFloat(n));
        return { text: view.state.doc.toString(), selection: view.state.selection.toJSON(), zero: view.coordsAtPos(from).left, four: view.coordsAtPos(from + 4).left, eight: view.coordsAtPos(from + 8).left, guide0: rect.left + stops[0], guide4: rect.left + stops[1], depth: line.getAttribute("data-indent-depth"), selectionCount: document.querySelectorAll(".cm-selectionBackground").length };
      }
      const before = measure();
      view.dispatch({ effects: guides.reconfigure([]) }); await tick(); const without = measure();
      view.dispatch({ effects: guides.reconfigure(practiceIndentGuides) }); await tick();
      view.scrollDOM.scrollLeft = 50; await tick(); const scrolled = measure();
      view.scrollDOM.scrollLeft = 0;
      view.dispatch({ effects: wrapping.reconfigure(EditorView.lineWrapping) }); await tick();
      const wrapped = measure();
      return { before, without, scrolled, wrapped, text };
    });
    for (const measured of [geometry.before, geometry.scrolled, geometry.wrapped]) {
      assert.equal(measured.depth, "2");
      assert(Math.abs(measured.guide0 - measured.zero) < 1, "first guide must align with actual caret column 0");
      assert(Math.abs(measured.guide4 - measured.four) < 1, "second guide must align with actual caret column 4");
      assert.equal(measured.text, geometry.text);
      assert.deepEqual(measured.selection, geometry.before.selection);
      assert(measured.selectionCount > 0, "guides must preserve painted selections");
    }
    for (const field of ["zero", "four", "eight"]) assert(Math.abs(geometry.before[field] - geometry.without[field]) < 0.1, "guides must not move text or caret geometry");
    console.log("Chrome geometry: guide pixels align with caret columns 0/4, horizontal scrolling and line wrapping stay aligned, selections remain visible, and disabling guides does not shift characters.");
  } finally { await browser.close(); }
}
