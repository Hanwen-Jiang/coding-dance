// 前端和 Pages Functions 共用的数据结构

export type Status = "已通过" | "曾通过" | "尝试过" | "未开始";
export type Level = "简单" | "中等" | "困难";
/** 重要程度：来自资源仓的 studyplan/优先级清单.md，100 题统一排序，和个人进度无关。Hot 20 排在 P0 前面 */
export type Tier = "Hot 20" | "P0" | "P1" | "P2" | "P3";

/** 资源仓里不变的题目信息 */
export interface ProblemSummary {
  id: number;
  name: string;
  level: Level;
  /** 题型（热题 100 的专题） */
  topic: string;
  tier: Tier;
  /** 在 100 题里的重要程度排名 */
  order: number;
  /** 在热题 100 题单里的顺序 */
  planOrder: number;
  hasSpec: boolean;
  hasIllustration: boolean;
}

/** 合并了当前用户进度之后的题目 */
export interface Problem extends ProblemSummary {
  status: Status;
  /** 用户进度仓里有题解的语言目录，如 java / python / go */
  langs: string[];
}

export interface IndexData {
  problems: ProblemSummary[];
  topics: string[];
}

/** 一种语言的代码：干净的源码，加上步骤标记 tag → 行号（从 1 开始；没有标记时不出现） */
export interface CodeText {
  code: string;
  marks?: Record<string, number[]>;
}

export interface SpecCode extends CodeText {
  t: string;
  kind: "elegant" | null;
  note: string | null;
  /** 演示的解法用它指到这段代码（demo.methods[].code）；第一段是 std */
  key?: string;
  /** code / marks 是 Python 的；其他语言在这里，没有的语言不出现 */
  langs?: Record<string, CodeText>;
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
  /** 多种解法的演示，共用 presets 和 random；第一个和 build 相同。旧数据没有这个字段 */
  methods?: DemoMethod[];
}

export interface DemoMethod {
  /** 解法名，如「递归沉岛」 */
  t: string;
  /** 一句话说明（可含 HTML） */
  note: string | null;
  legend: [string, string][];
  build: string;
  /** 这种解法对应哪段代码（SpecCode.key）：播放器显示它，并高亮每一步的 at 指到的行 */
  code?: string;
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
  /** 题面配图：图片文件名 → 演示同款的视图，网站用它替换题面里力扣的图片 */
  figures?: Record<string, Record<string, unknown>[]>;
}

export interface HistoryFile {
  lang: string;
  label: string;
  file: string;
  code: string;
}

export type AttemptResult = "通过" | "答案错误" | "超时" | "运行出错" | "思路不成立";

/** 进度仓 attempts/ 里的一次尝试 */
export interface Attempt {
  file: string;
  date: string;
  seq: number;
  result: AttemptResult;
  lang: string;
  /** false：代码不是原样提交 */
  verbatim: boolean;
  sections: { title: string; text: string }[];
  code: string | null;
  /** 文件格式不对时的提示（仍然尽量显示） */
  errors: string[];
  /** 从哪里同步来的，比如 leetcode.cn（手写的记录没有） */
  source: string | null;
  /** 力扣的提交编号（只含数字），有的话可以链接到力扣上的这次提交 */
  submission: string | null;
  /** 提交时间，如 2026-11-14T10:05:00+08:00 */
  submittedAt: string | null;
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
  illustrationUrl: string | null;
  prev: ProblemLink | null;
  next: ProblemLink | null;
  /** 相关的基础专题（专题的 related 里有这道题）；旧接口没有这个字段 */
  learn?: TopicLink[];
}

/** 基础专题：数据结构（ds）或算法（algo） */
export type TopicKind = "ds" | "algo";

export interface TopicLink {
  slug: string;
  name: string;
  kind: TopicKind;
}

/** tools/illustrations/data/topics/index.json 里的一项 */
export interface TopicSummary extends TopicLink {
  order: number;
  lede: string;
  /** 相关的热题题号 */
  related: number[];
  sections: { key: string; t: string; demo: boolean }[];
}

/** 专题的一小节：讲解 + 代码（六种语言）+ 演示 */
export interface TopicSection {
  key: string;
  t: string;
  /** 段落 HTML */
  body: string[];
  points: { t: string; body: string }[];
  codes: SpecCode[];
  demo: Demo | null;
}

/** tools/illustrations/data/topics/<slug>.json */
export interface Topic extends TopicLink {
  order: number;
  lede: string;
  related: number[];
  sections: TopicSection[];
}

/** /api/topic/<slug> */
export interface TopicDetail {
  topic: Topic;
  /** 相关热题，顺序和 topic.related 一致 */
  problems: ProblemSummary[];
  prev: TopicLink | null;
  next: TopicLink | null;
}

export const TOPIC_KIND: Record<TopicKind, { label: string; en: string; desc: string }> = {
  ds: { label: "数据结构", en: "DATA STRUCTURES", desc: "怎么定义、怎么构造、常用的写法" },
  algo: { label: "算法", en: "ALGORITHMS", desc: "常见算法的模板和它适合的题" },
};

/** /api/session */
export interface SessionInfo {
  configured: boolean;
  template: string;
  repoName: string;
  /** GitHub「用模板新建仓库」页面 */
  createUrl: string;
  user: { login: string; avatar: string } | null;
  /** 会员档位（登录后才有）。founder：创始会员，永久最高档；since：第一次授权或建进度仓的日期 */
  member?: { tier: "free" | "pro"; founder: boolean; since: string | null };
  repo: {
    name: string;
    url: string;
    /** 仓库建好了没有 */
    exists: boolean;
    /** 授权范围里有没有这个仓库（有了网站才能读写） */
    accessible: boolean;
    /** 用户有没有把 App 授权到自己账号上（不管范围里有没有进度仓） */
    installed: boolean;
    /** 网站能不能直接替用户建进度仓（已经授权，并且授权里带建仓库的权限） */
    canCreate: boolean;
    /** 已经装过 App 但没选这个仓库时，去这里把它加上 */
    manageUrl: string | null;
  } | null;
  /** 下面这些仓库是不是都 Star 了 */
  starred: boolean;
  /** 页面上请用户点 Star 的仓库，各自 Star 了没有 */
  stars: { repo: string; starred: boolean }[];
  /** 网站有几个域名、这个会话还没同步到其余域名时，列出要同步的域名（只在登录域名上出现，见 functions/_lib/sso.ts） */
  spread?: string[] | null;
}

/** POST /api/progress/star 里每个仓库的结果；没点上时 status 是 GitHub 返回的状态码 */
export interface StarResult {
  repo: string;
  starred: boolean;
  status: number;
}

/** 进度仓里的 settings.json：用户的设置。langs 是常用语言，第一个是默认语言 */
export interface Settings {
  langs: string[];
}

/** /api/progress */
export interface ProgressData {
  status: Record<string, Status>;
  langs: Record<string, string[]>;
  /** 进度仓里还没有 settings.json 时是 null */
  settings?: Settings | null;
}

export const TIER_ORDER: Tier[] = ["Hot 20", "P0", "P1", "P2", "P3"];
export const LEVEL_ORDER: Level[] = ["简单", "中等", "困难"];
export const STATUS_ORDER: Status[] = ["未开始", "尝试过", "曾通过", "已通过"];

export const TIER_INFO: Record<Tier, { label: string; desc: string }> = {
  "Hot 20": { label: "Hot 20 · 重点", desc: "面试最高频，最先做" },
  P0: { label: "P0 · 必做", desc: "高频原题" },
  P1: { label: "P1 · 重要", desc: "固定套路" },
  P2: { label: "P2 · 补全", desc: "中频与变形" },
  P3: { label: "P3 · 选做", desc: "偏难或少考" },
};

/** 按重要程度比较 */
export const byImportance = (a: ProblemSummary, b: ProblemSummary) =>
  TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.order - b.order || a.id - b.id;
