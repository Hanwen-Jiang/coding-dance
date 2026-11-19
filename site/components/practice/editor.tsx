"use client";

import CodeMirror, { keymap, Prec } from "@uiw/react-codemirror";
import { acceptCompletion, autocompletion, completeAnyWord } from "@codemirror/autocomplete";
import { cpp } from "@codemirror/lang-cpp";
import { go, localCompletionSource as goLocals } from "@codemirror/lang-go";
import { java } from "@codemirror/lang-java";
import { javascript, localCompletionSource as jsLocals } from "@codemirror/lang-javascript";
import { localCompletionSource as pyLocals, python } from "@codemirror/lang-python";
import { indentUnit, LanguageSupport, StreamLanguage, type StreamParser } from "@codemirror/language";
import { clike, csharp, dart, kotlin, scala } from "@codemirror/legacy-modes/mode/clike";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";

import type { PracticeHints, PracticeLanguage } from "@/lib/practice/types";
import { debugExtensions, setDebugLine } from "./editor-debug";
import { practiceEditorTheme } from "./editor-theme";
import { practiceIndentGuides } from "./editor-guides";

/** 后加的几种云端语言用 CodeMirror 5 的旧语法模式（体积小，只管上色和缩进） */
const legacy = (parser: StreamParser<unknown>) => () => new LanguageSupport(StreamLanguage.define(parser));
const words = (s: string) => Object.fromEntries(s.split(" ").map((w) => [w, true]));
/** PHP：旧模式里的 PHP 要连着 HTML 一起，这里用 clike 拼一个只认 PHP 代码的 */
const phpMode = clike({
  name: "php",
  keywords: words("abstract and array as break case catch class clone const continue declare default do echo else elseif empty extends final finally fn for foreach function global if implements instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once include include_once return static switch throw trait try unset use var while xor yield"),
  types: words("int float string bool array object mixed void callable iterable self parent"),
  atoms: words("true false null TRUE FALSE NULL"),
  blockKeywords: words("catch do else elseif finally for foreach if switch try while match"),
  defKeywords: words("class function interface trait fn"),
  hooks: { "$": (stream: { eatWhile: (re: RegExp) => boolean }) => { stream.eatWhile(/[\w]/); return "variableName.special"; }, "#": (stream: { skipToEnd: () => void }) => { stream.skipToEnd(); return "comment"; } },
} as Parameters<typeof clike>[0]);
const LANG: Record<PracticeLanguage, () => ReturnType<typeof python>> = {
  python: () => python(),
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  java: () => java(),
  cpp: () => cpp(),
  go: () => go(),
  c: () => cpp(),
  csharp: legacy(csharp),
  kotlin: legacy(kotlin),
  swift: legacy(swift),
  rust: legacy(rust),
  ruby: legacy(ruby),
  php: legacy(phpMode),
  scala: legacy(scala),
  dart: legacy(dart),
};
/** 「无提示」时唯一的补全来源：代码里已有的名字 */
const LOCALS: Record<PracticeLanguage, typeof completeAnyWord> = {
  python: pyLocals, javascript: jsLocals, typescript: jsLocals, java: completeAnyWord, cpp: completeAnyWord, go: goLocals,
  c: completeAnyWord, csharp: completeAnyWord, kotlin: completeAnyWord, swift: completeAnyWord, rust: completeAnyWord, ruby: completeAnyWord, php: completeAnyWord, scala: completeAnyWord, dart: completeAnyWord,
};
/** 缩进：和力扣起始代码一样（Dart 两格，Go 用制表符，其余四格） */
const INDENT: Partial<Record<PracticeLanguage, string>> = { javascript: "  ", typescript: "  ", dart: "  ", go: "\t" };
/** 语言包不带补全的：完整提示时补全文档里出现过的词 */
const WORD_COMPLETE = new Set<PracticeLanguage>(["java", "cpp", "c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart"]);

/**
 * hints：补全给多少。语法颜色、括号配对、自动缩进、缩进线两档都有。
 * full：关键字、内置函数、库函数、类型都会提示，加上代码里已有的变量；
 * none：只补全代码里已经定义的变量和函数，不提示有哪些函数、类型、关键字可用（练习不靠提示写代码）。
 */
export function PracticeEditor({ language, code, onChange, ready, hints = "full", wrap = true, debugLine = null, onBreakpoints }: {
  language: PracticeLanguage;
  code: string;
  onChange: (code: string) => void;
  ready: boolean;
  hints?: PracticeHints;
  /** 长行折到下一行显示（默认）；false 时不折行，横向滚动 */
  wrap?: boolean;
  /** 调试时当前执行到的行（从 1 开始），高亮并滚到能看见；null 表示没在调试 */
  debugLine?: number | null;
  /** 断点变了：行号左边那一栏点一下加上或去掉断点 */
  onBreakpoints?: (lines: number[]) => void;
}) {
  const { resolvedTheme } = useTheme();
  const full = hints === "full";
  const view = useRef<EditorView | null>(null);
  const breakpointsCb = useRef(onBreakpoints);
  breakpointsCb.current = onBreakpoints;
  const debug = useMemo(() => debugExtensions((lines) => breakpointsCb.current?.(lines)), []);
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const line = debugLine != null && debugLine >= 1 && debugLine <= v.state.doc.lines ? v.state.doc.line(debugLine) : null;
    v.dispatch({ effects: [setDebugLine.of(line ? debugLine : null), ...(line ? [EditorView.scrollIntoView(line.from, { y: "nearest" })] : [])] });
  }, [debugLine]);
  const extensions = useMemo(() => [
    debug,
    LANG[language](),
    indentUnit.of(INDENT[language] ?? "    "),
    practiceIndentGuides,
    ...(wrap ? [EditorView.lineWrapping] : []),
    // Java / C++ 和旧语法模式的语言不带补全：完整提示时补全文档里出现过的词
    ...(full && WORD_COMPLETE.has(language) ? [EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }])] : []),
    // 「无提示」：用自己的补全代替语言自带的，只留局部变量这一个来源
    ...(full ? [] : [autocompletion({ override: [LOCALS[language]] })]),
    EditorView.contentAttributes.of({ "aria-label": "代码编辑器", spellcheck: "false", "data-testid": "practice-code", "data-hints": hints }),
    Prec.highest(keymap.of([{ key: "Tab", run: acceptCompletion }])),
    ...practiceEditorTheme(resolvedTheme === "dark"),
  ], [debug, language, resolvedTheme, hints, full, wrap]);

  return (
    <CodeMirror
      // 行号由 editor-debug.ts 提供（点行号能切换断点），这里关掉
      basicSetup={{ lineNumbers: false, highlightActiveLineGutter: false, foldGutter: true, autocompletion: full, highlightActiveLine: false, drawSelection: true, syntaxHighlighting: false }}
      className="practice-editor"
      editable={ready}
      extensions={extensions}
      height="100%"
      indentWithTab
      onChange={onChange}
      onCreateEditor={(v) => { view.current = v; }}
      theme="none"
      value={code}
    />
  );
}

export default PracticeEditor;
