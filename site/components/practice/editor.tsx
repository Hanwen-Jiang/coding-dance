"use client";

import CodeMirror, { keymap, Prec } from "@uiw/react-codemirror";
import { acceptCompletion, autocompletion, completeAnyWord } from "@codemirror/autocomplete";
import { cpp } from "@codemirror/lang-cpp";
import { go, localCompletionSource as goLocals } from "@codemirror/lang-go";
import { java } from "@codemirror/lang-java";
import { javascript, localCompletionSource as jsLocals } from "@codemirror/lang-javascript";
import { localCompletionSource as pyLocals, python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";

import type { PracticeHints, PracticeLanguage } from "@/lib/practice/types";
import { debugExtensions, setDebugLine } from "./editor-debug";
import { practiceEditorTheme } from "./editor-theme";
import { practiceIndentGuides } from "./editor-guides";

const LANG: Record<PracticeLanguage, () => ReturnType<typeof python>> = {
  python: () => python(),
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  java: () => java(),
  cpp: () => cpp(),
  go: () => go(),
};
/** 「无提示」时唯一的补全来源：代码里已有的名字 */
const LOCALS: Record<PracticeLanguage, typeof completeAnyWord> = { python: pyLocals, javascript: jsLocals, typescript: jsLocals, java: completeAnyWord, cpp: completeAnyWord, go: goLocals };

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
    indentUnit.of(language === "python" || language === "java" || language === "cpp" ? "    " : language === "go" ? "\t" : "  "),
    practiceIndentGuides,
    ...(wrap ? [EditorView.lineWrapping] : []),
    // Java / C++ 的语言包不带补全：完整提示时补全文档里出现过的词
    ...(full && (language === "java" || language === "cpp") ? [EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }])] : []),
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
