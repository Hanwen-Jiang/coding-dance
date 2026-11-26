"use client";

import { Button } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { useEffect, useState } from "react";

import { CodePanel } from "@/components/code-panel";
import { CodeIcon } from "@/components/icons";
import { LangTabs } from "@/components/lang-picker";
import { codeIn, langLabel, langsFor } from "@/lib/langs";
import { buildAcmSolution } from "@/lib/practice/acm-solution";
import type { PracticeLanguage, PracticeMode, PracticeSignature } from "@/lib/practice/types";
import { usePrefs } from "@/lib/prefs";
import type { SpecCode } from "@/lib/types";

/**
 * 一种写法的代码：按用户的常用语言显示，可以切换。
 * 在题目页传入 signature 与 parameterNames 后，支持在「LeetCode 核心代码」与「ACM 完整 I/O」题解之间一键切换，
 * 并可直接将对应模式的代码填入右侧练习编辑器。
 */
export function SolutionCode({
  code,
  signature,
  parameterNames,
  preferredMode = "leetcode",
  onApplyCode,
}: {
  code: SpecCode;
  signature?: PracticeSignature;
  parameterNames?: string[];
  preferredMode?: PracticeMode;
  onApplyCode?: (code: string, lang: PracticeLanguage, mode: PracticeMode) => void;
}) {
  const { langs: prefs } = usePrefs();
  const { langs, fallback } = langsFor(code, prefs);
  const [picked, setPicked] = useState<string | null>(null);
  const [solutionMode, setSolutionMode] = useState<PracticeMode>(preferredMode);
  useEffect(() => {
    setSolutionMode(preferredMode);
  }, [preferredMode]);

  const lang = picked && langs.includes(picked) ? picked : langs[0];
  const text = codeIn(code, lang) ?? code;
  const acm = signature ? buildAcmSolution(text.code, lang, signature, parameterNames ?? []) : null;
  const activeMode: PracticeMode = acm && solutionMode === "acm" ? "acm" : "leetcode";
  const shownCode = activeMode === "acm" && acm ? acm.code : text.code;
  const baseLabel = lang === "python" ? "Python 3" : langLabel(lang);
  const panelLabel = activeMode === "acm" ? `${baseLabel} · ACM 完整 I/O` : baseLabel;

  return (
    <div className="flex flex-col gap-2.5">
      {(langs.length > 1 || fallback || acm || onApplyCode) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {(langs.length > 1 || fallback) && (
              <LangTabs label="代码的语言" langs={langs} value={lang} onChange={setPicked} />
            )}
            {acm && (
              <Segment
                aria-label="题解版本"
                onSelectionChange={(k) => setSolutionMode(String(k) as PracticeMode)}
                selectedKey={activeMode}
                size="sm"
                variant="ghost"
              >
                <Segment.Item id="leetcode">LeetCode 核心代码</Segment.Item>
                <Segment.Item id="acm">ACM 完整 I/O</Segment.Item>
              </Segment>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {fallback && (
              <span className="text-xs text-muted">
                这种写法是 Python 特有的，没有 {prefs.map(langLabel).join(" / ")} 版本。
              </span>
            )}
            {onApplyCode && (
              <Button
                className="h-7 min-h-7 px-2.5 text-xs"
                onPress={() => onApplyCode(shownCode, lang as PracticeLanguage, activeMode)}
                size="sm"
                variant="secondary"
              >
                <CodeIcon height={13} width={13} />
                填入编辑器
              </Button>
            )}
          </div>
        </div>
      )}
      {activeMode === "acm" && acm && acm.tips.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-warning/25 bg-warning/[0.06] px-3 py-2 text-xs leading-5 text-muted">
          <span className="font-semibold text-foreground">ACM 读写要点</span>
          <ul className="m-0 list-disc space-y-0.5 pl-4">
            {acm.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <CodePanel code={shownCode} label={panelLabel} lang={lang} />
    </div>
  );
}
