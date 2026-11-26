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
      {copied ? (
        <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 16 16" width="12">
          <path d="M3 8.5 6.5 12 13 4.5" />
        </svg>
      ) : (
        <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 16 16" width="12">
          <rect height="9" rx="1.5" width="9" x="5" y="5" />
          <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
        </svg>
      )}
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
