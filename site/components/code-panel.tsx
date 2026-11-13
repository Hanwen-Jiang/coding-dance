"use client";

import { CodeBlock } from "@heroui-pro/react/code-block";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const SHIKI_LANG: Record<string, string> = { python: "python", java: "java", go: "go", cpp: "cpp" };

export function CodePanel({ code, lang, label }: { code: string; lang: string; label: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const theme = mounted && resolvedTheme === "dark" ? "github-dark" : "github-light";
  return (
    <CodeBlock className="code-scroll">
      <CodeBlock.Header>
        <span className="font-mono text-xs uppercase tracking-wide text-muted">{label}</span>
        <CodeBlock.CopyButton aria-label="复制代码" code={code} />
      </CodeBlock.Header>
      <CodeBlock.Code key={theme} code={code} language={SHIKI_LANG[lang] ?? "plaintext"} theme={theme} />
    </CodeBlock>
  );
}
