"use client";

// 演示旁边的代码面板：显示一段代码，高亮当前这一步对应的行，并把它们滚到看得见的位置。
// 用 shiki 分词后自己渲染每一行（HeroUI 的 CodeBlock 不能给单独的行加样式）。
import clsx from "clsx";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { codeToTokens } from "shiki";

type Tok = { content: string; color?: string; fontStyle?: number };
const SHIKI: Record<string, string> = { python: "python", java: "java", cpp: "cpp", go: "go", javascript: "javascript", typescript: "typescript" };

function tokStyle(t: Tok): React.CSSProperties | undefined {
  if (!t.color && !t.fontStyle) return undefined;
  return { color: t.color, fontStyle: t.fontStyle && t.fontStyle & 1 ? "italic" : undefined, fontWeight: t.fontStyle && t.fontStyle & 2 ? 600 : undefined };
}

export function StepCode({ code, lang, active }: { code: string; lang: string; active: number[] }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const theme = mounted && resolvedTheme === "dark" ? "github-dark" : "github-light";

  // 分词是异步的：结果没到之前先显示不带颜色的代码，行数和位置不变
  const plain = useMemo(() => code.split("\n").map((l) => [{ content: l }] as Tok[]), [code]);
  const key = `${lang}\n${theme}\n${code}`;
  const [colored, setColored] = useState<{ key: string; lines: Tok[][] } | null>(null);
  useEffect(() => {
    let alive = true;
    codeToTokens(code, { lang: (SHIKI[lang] ?? "text") as "python", theme })
      .then((r) => { if (alive) setColored({ key, lines: r.tokens as Tok[][] }); })
      .catch(() => { /* 分词失败就一直显示不带颜色的 */ });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = colored?.key === key ? colored.lines : plain;

  const on = useMemo(() => new Set(active), [active]);
  const box = useRef<HTMLDivElement>(null);
  const sig = active.join(",");
  // 高亮的行不在可见范围里时，把它们滚到面板中间（只滚这个面板，页面不动）
  useEffect(() => {
    const el = box.current;
    if (!el || !active.length) return;
    const first = el.querySelector<HTMLElement>(`[data-line="${Math.min(...active)}"]`);
    const last = el.querySelector<HTMLElement>(`[data-line="${Math.max(...active)}"]`);
    if (!first || !last) return;
    const top = first.offsetTop, bottom = last.offsetTop + last.offsetHeight, pad = 28;
    if (top < el.scrollTop + pad || bottom > el.scrollTop + el.clientHeight - pad) {
      el.scrollTo({ top: Math.max(0, (top + bottom) / 2 - el.clientHeight / 2), behavior: "smooth" });
    }
  }, [sig, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={box} className="relative max-h-[24rem] overflow-auto rounded-2xl border border-border bg-surface font-mono text-[12.5px] leading-[1.6] [tab-size:4]">
      <div className="min-w-max py-2">
        {lines.map((line, i) => {
          const n = i + 1, hit = on.has(n);
          return (
            <div
              key={i}
              className={clsx("flex border-l-2 pe-4 transition-colors duration-200", hit ? "border-accent bg-accent/[0.13]" : "border-transparent", !hit && on.size > 0 && "opacity-60")}
              data-active={hit || undefined}
              data-line={n}
            >
              <span className={clsx("w-9 shrink-0 select-none pe-3 text-right", hit ? "text-accent" : "text-muted/60")}>{n}</span>
              <span className="whitespace-pre">
                {line.length ? line.map((t, k) => <span key={k} style={tokStyle(t)}>{t.content}</span>) : " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
