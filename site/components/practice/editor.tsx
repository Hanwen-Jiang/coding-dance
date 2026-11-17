"use client";

import CodeMirror, { keymap, Prec } from "@uiw/react-codemirror";
import { acceptCompletion } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { useTheme } from "next-themes";
import { useMemo } from "react";

import type { PracticeLanguage } from "@/lib/practice/types";
import { practiceEditorTheme } from "./editor-theme";
import { practiceIndentGuides } from "./editor-guides";

export function PracticeEditor({ language, code, onChange, ready }: {
  language: PracticeLanguage;
  code: string;
  onChange: (code: string) => void;
  ready: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const extensions = useMemo(() => [
    language === "python" ? python() : javascript({ typescript: language === "typescript" }),
    indentUnit.of(language === "python" ? "    " : "  "),
    practiceIndentGuides,
    EditorView.contentAttributes.of({ "aria-label": "代码编辑器", spellcheck: "false", "data-testid": "practice-code" }),
    Prec.highest(keymap.of([{ key: "Tab", run: acceptCompletion }])),
    ...practiceEditorTheme(resolvedTheme === "dark"),
  ], [language, resolvedTheme]);

  return (
    <CodeMirror
      basicSetup={{ lineNumbers: true, highlightActiveLineGutter: false, foldGutter: true, autocompletion: true, highlightActiveLine: false, drawSelection: true, syntaxHighlighting: false }}
      className="practice-editor"
      editable={ready}
      extensions={extensions}
      height="var(--practice-editor-height, clamp(560px, 64dvh, 680px))"
      indentWithTab
      onChange={onChange}
      theme="none"
      value={code}
    />
  );
}

export default PracticeEditor;
