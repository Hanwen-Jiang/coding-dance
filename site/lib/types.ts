// 前端和 Pages Functions 共用的数据结构

export type Status = "已通过" | "曾通过" | "未开始";
export type Level = "简单" | "中等" | "困难";
/** 重要程度档位：来自 studyplan/优先级清单.md，没列出的已通过题归为「已通过」 */
export type Tier = "P0" | "P1" | "P2" | "复习" | "已通过" | "困难";

export interface ProblemSummary {
  id: number;
  name: string;
  level: Level;
  /** 题型（热题 100 的专题） */
  topic: string;
  status: Status;
  tier: Tier;
  /** 在所属档位里的顺序 */
  order: number;
  /** 在热题 100 题单里的顺序 */
  planOrder: number;
  /** 有历史题解的语言目录，如 java / python / go */
  langs: string[];
  hasSpec: boolean;
  hasIllustration: boolean;
}

export interface IndexData {
  problems: ProblemSummary[];
  topics: string[];
}

export interface SpecCode {
  t: string;
  kind: "elegant" | null;
  note: string | null;
  code: string;
}

export interface Demo {
  title: string;
  /** [颜色角色, 说明] */
  legend: [string, string][];
  presets: { label: string; args: unknown; note: string }[];
  /** spec 里 build 方法的源码 */
  build: string;
  /** 随机输入：自包含的函数源码，调用后返回 { args, note }；没有时为 null */
  random?: string | null;
}

export interface Spec {
  demo: Demo | null;
  id: number;
  name: string;
  level: Level;
  topic: string;
  h1: string;
  lede: string;
  handwritten: boolean;
  hints: { t: string; body: string[] }[];
  points: { t: string; body: string }[];
  codes: SpecCode[];
}

export interface HistoryFile {
  lang: string;
  label: string;
  file: string;
  code: string;
}

export interface ProblemLink {
  id: number;
  name: string;
}

export interface ProblemDetail {
  summary: ProblemSummary;
  slug: string | null;
  statementHtml: string;
  spec: Spec | null;
  history: HistoryFile[];
  illustrationUrl: string | null;
  prev: ProblemLink | null;
  next: ProblemLink | null;
}

export const TIER_ORDER: Tier[] = ["P0", "P1", "P2", "复习", "已通过", "困难"];
export const LEVEL_ORDER: Level[] = ["简单", "中等", "困难"];

export const TIER_INFO: Record<Tier, { label: string; desc: string }> = {
  P0: { label: "P0 · 必做", desc: "高频原题" },
  P1: { label: "P1 · 重要", desc: "固定套路" },
  P2: { label: "P2 · 补全", desc: "技巧题" },
  复习: { label: "复习 · 曾通过", desc: "按常考程度排" },
  已通过: { label: "已通过", desc: "" },
  困难: { label: "困难题", desc: "最后再做" },
};

/** 按重要程度比较：先档位，再档位内顺序 */
export const byImportance = (a: ProblemSummary, b: ProblemSummary) =>
  TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.order - b.order || a.id - b.id;
