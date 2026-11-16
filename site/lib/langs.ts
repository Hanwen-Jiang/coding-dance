// 官方题解支持的语言。顺序和 tools/illustrations/judge/code.js 里的 LANGS 一致。
import type { CodeText, SpecCode } from "@/lib/types";

export const OFFICIAL_LANGS = [
  { id: "python", label: "Python", short: "Py" },
  { id: "java", label: "Java", short: "Java" },
  { id: "cpp", label: "C++", short: "C++" },
  { id: "go", label: "Go", short: "Go" },
  { id: "javascript", label: "JavaScript", short: "JS" },
  { id: "typescript", label: "TypeScript", short: "TS" },
] as const;

export const DEFAULT_LANGS = ["python"];
const IDS: string[] = OFFICIAL_LANGS.map((l) => l.id);

export const langLabel = (id: string) => OFFICIAL_LANGS.find((l) => l.id === id)?.label ?? id;
export const langShort = (id: string) => OFFICIAL_LANGS.find((l) => l.id === id)?.short ?? id;

/** 只留官方题解有的语言，去掉重复；一个都不剩就是默认的 Python */
export function cleanLangs(x: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(x)) for (const l of x) if (typeof l === "string" && IDS.includes(l) && !out.includes(l)) out.push(l);
  return out.length ? out : DEFAULT_LANGS;
}

/** 一段代码在某种语言下的内容；没有这种语言返回 null */
export function codeIn(c: SpecCode, lang: string): CodeText | null {
  if (lang === "python") return { code: c.code, marks: c.marks };
  return c.langs?.[lang] ?? null;
}

/**
 * 这段代码该给用户看哪些语言：按用户的常用语言顺序，只留这段代码有的。
 * 一种都没有（比如只有 Python 的简洁写法，而用户没选 Python）就显示 Python，fallback 为真。
 */
export function langsFor(c: SpecCode, prefs: string[]): { langs: string[]; fallback: boolean } {
  const langs = prefs.filter((l) => codeIn(c, l));
  return langs.length ? { langs, fallback: false } : { langs: ["python"], fallback: true };
}
