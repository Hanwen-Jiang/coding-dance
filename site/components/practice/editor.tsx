"use client";

import CodeMirror, { keymap, Prec } from "@uiw/react-codemirror";
import { acceptCompletion, autocompletion } from "@codemirror/autocomplete";
import { javascript, localCompletionSource as jsLocals } from "@codemirror/lang-javascript";
import { localCompletionSource as pyLocals, python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { useTheme } from "next-themes";
import { useMemo } from "react";

import type { PracticeHints, PracticeLanguage } from "@/lib/practice/types";
import { practiceEditorTheme } from "./editor-theme";
import { practiceIndentGuides } from "./editor-guides";

/**
 * hints：补全给多少。语法颜色、括号配对、自动缩进、缩进线两档都有。
 * full：关键字、内置函数、库函数、类型都会提示，加上代码里已有的变量；
 * none：只补全代码里已经定义的变量和函数，不提示有哪些函数、类型、关键字可用（练习不靠提示写代码）。
 */
export function PracticeEditor({ language, code, onChange, ready, hints = "full" }: {
  language: PracticeLanguage;
  code: string;
  onChange: (code: string) => void;
  ready: boolean;
  hints?: PracticeHints;
}) {
  const { resolvedTheme } = useTheme();
  const full = hints === "full";
  const extensions = useMemo(() => [
    language === "python" ? python() : javascript({ typescript: language === "typescript" }),
    indentUnit.of(language === "python" ? "    " : "  "),
    practiceIndentGuides,
    // 「无提示」：用自己的补全代替语言自带的，只留局部变量这一个来源
    ...(full ? [] : [autocompletion({ override: [language === "python" ? pyLocals : jsLocals] })]),
    EditorView.contentAttributes.of({ "aria-label": "代码编辑器", spellcheck: "false", "data-testid": "practice-code", "data-hints": hints }),
    Prec.highest(keymap.of([{ key: "Tab", run: acceptCompletion }])),
    ...practiceEditorTheme(resolvedTheme === "dark"),
  ], [language, resolvedTheme, hints, full]);

  return (
    <CodeMirror
      basicSetup={{ lineNumbers: true, highlightActiveLineGutter: false, foldGutter: true, autocompletion: full, highlightActiveLine: false, drawSelection: true, syntaxHighlighting: false }}
      className="practice-editor"
      editable={ready}
      extensions={extensions}
      height="100%"
      indentWithTab
      onChange={onChange}
      theme="none"
      value={code}
    />
  );
}

export default PracticeEditor;
