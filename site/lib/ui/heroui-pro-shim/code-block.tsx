"use client";

import clsx from "clsx";
import React, { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

function CodeBlockRoot({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="code-block" className={clsx("code-block", className)} {...rest}>
      {children}
    </div>
  );
}

function CodeBlockHeader({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="code-block-header" className={clsx("code-block__header", className)} {...rest}>
      {children}
    </div>
  );
}

function CodeBlockCopyButton({
  code,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-slot="code-block-copy-button"
      className={clsx("code-block__copy-button button--icon-only button--sm inline-flex items-center justify-center rounded-md", className)}
      onClick={() => {
        void navigator.clipboard?.writeText(code);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      {...rest}
    >
      <span className="font-mono text-[11px]">{copied ? "✓" : "复制"}</span>
    </button>
  );
}

function CodeBlockCode({
  code,
  language = "plaintext",
  theme = "github-light",
  className,
}: {
  code: string;
  language?: string;
  theme?: string;
  className?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, { lang: language, theme })
      .then((out) => {
        if (!cancelled) setHtml(out);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, language, theme]);

  if (html) {
    return (
      <div
        data-slot="code-block-code"
        className={clsx("code-block__code", className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <div data-slot="code-block-code" className={clsx("code-block__code", className)}>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const CodeBlock = Object.assign(CodeBlockRoot, {
  Header: CodeBlockHeader,
  CopyButton: CodeBlockCopyButton,
  Code: CodeBlockCode,
});
