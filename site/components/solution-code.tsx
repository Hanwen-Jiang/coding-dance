"use client";

import { useState } from "react";

import { CodePanel } from "@/components/code-panel";
import { LangTabs } from "@/components/lang-picker";
import { codeIn, langLabel, langsFor } from "@/lib/langs";
import { usePrefs } from "@/lib/prefs";
import type { SpecCode } from "@/lib/types";

/** 一种写法的代码：按用户的常用语言显示，可以切换；这种写法没有用户选的语言时显示 Python（题目页的题解和专题页共用） */
export function SolutionCode({ code }: { code: SpecCode }) {
  const { langs: prefs } = usePrefs();
  const { langs, fallback } = langsFor(code, prefs);
  const [picked, setPicked] = useState<string | null>(null);
  const lang = picked && langs.includes(picked) ? picked : langs[0];
  const text = codeIn(code, lang) ?? code;
  return (
    <div className="flex flex-col gap-2">
      {(langs.length > 1 || fallback) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LangTabs label="代码的语言" langs={langs} value={lang} onChange={setPicked} />
          {fallback && <span className="text-xs text-muted">这种写法是 Python 特有的，没有 {prefs.map(langLabel).join(" / ")} 版本。</span>}
        </div>
      )}
      <CodePanel code={text.code} label={lang === "python" ? "Python 3" : langLabel(lang)} lang={lang} />
    </div>
  );
}
