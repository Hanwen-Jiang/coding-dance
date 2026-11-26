/**
 * python / javascript / typescript 默认在浏览器里运行，也可以选云端；其余只在云端的运行器（tools/runner，经 /api/run）上运行：
 * java / cpp / go 还能用真调试器调试，c / csharp / kotlin / swift / rust / ruby / php / scala / dart 只能运行
 */
export type PracticeLanguage = "python" | "javascript" | "typescript" | "java" | "cpp" | "go"
  | "c" | "csharp" | "kotlin" | "swift" | "rust" | "ruby" | "php" | "scala" | "dart";
/** 练习区所有语言，顺序就是语言菜单里的顺序 */
export const PRACTICE_LANGUAGES: PracticeLanguage[] = ["python", "javascript", "typescript", "java", "cpp", "go", "c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart"];
/** 编辑器补全：完整（关键字、内置函数、库函数、类型都提示）/ 无提示（只补全代码里已有的变量和函数） */
export type PracticeHints = "full" | "none";
export type PracticeMode = "leetcode" | "acm";
/** 在哪里运行：浏览器（不用登录）/ 云端（要登录）。只有 Python、JavaScript、TypeScript 能选，其余语言总在云端 */
export type PracticeTarget = "browser" | "cloud";
export type PracticeComparison = "unordered" | "length" | null;

export interface PracticeSignature {
  fn?: string;
  params?: string[];
  ret?: string;
  out?: number;
  cmp?: PracticeComparison;
  cls?: string;
  ctor?: string[];
  methods?: Record<string, [string[], string]>;
  pythonFn?: string;
  pythonMethods?: Record<string, string>;
}

export interface PracticeCase {
  input: unknown[];
  expected: unknown;
  stdin: string;
  stdout: string;
  label?: string;
  /** 「精简边界测试」也跑这一组：题目示例、预设、手写的边界用例（固定种子的随机用例没有这个标记，只在全量测试里跑） */
  quick?: boolean;
  /** Exact checked-in statement example, when this case comes from the problem document. */
  source?: { path: string; index: number; input: string; output: string };
}

export interface PracticeProblem {
  id: number;
  name: string;
  signature: PracticeSignature;
  parameterNames: string[];
  starters: Record<PracticeMode, Record<PracticeLanguage, string>>;
  /** 力扣模式做不了的语言和原因（Rust 的几道链表题，Box 表示不了成环、共用节点）；ACM 模式照常 */
  leetcodeUnavailable?: Partial<Record<PracticeLanguage, string>>;
  cases: PracticeCase[];
  examples: PracticeCase[];
  /** FNV-1a of the previous generated ACM starters; only untouched defaults are migrated. */
  legacyAcmStarterHashes: Partial<Record<PracticeLanguage, string>>;
  /** Other earlier untouched defaults, including the former short main/fs skeletons. */
  previousAcmStarterHashes: Partial<Record<PracticeLanguage, string[]>>;
  /** 上一版力扣模式起始代码（带 from typing import * 和 raise / throw）的指纹：没改过的旧草稿换成新模板 */
  previousLeetcodeStarterHashes?: Partial<Record<PracticeLanguage, string[]>>;
  acm: {
    description: string;
    input: string;
    output: string;
    notes: string[];
    examples: { input: string; output: string; explanation?: string }[];
  };
}

export interface PracticeRunRequest {
  problem: PracticeProblem;
  language: PracticeLanguage;
  mode: PracticeMode;
  code: string;
  cases: PracticeCase[];
  /** 调试：只跑一组用例，同时记下每一步执行到哪一行、当时的变量 */
  debug?: boolean;
  /** 调试时额外追踪求值的变量或表达式（浏览器录制期同步记录每步值） */
  watch?: string[];
  /** Python、JavaScript、TypeScript 选了云端就交给运行器（调试除外：云端不调试这三种，仍在浏览器里）；其余语言总在云端 */
  target?: PracticeTarget;
}
/** 调试记录里的一步：执行到第 line 行之前（event=line），或者函数返回（return）、抛出异常（exception）时 */
export interface PracticeTraceStep {
  line: number;
  event: "line" | "return" | "exception";
  /** 当前函数名（ACM 模式最外层是 <module>） */
  fn: string;
  /** 调用栈（只算用户的代码），外层在前：[函数名, 行号] */
  stack: [string, number][];
  /** 当前函数里看得到的变量：[名字, 显示用的值] */
  vars: [string, string][];
  /** 用户指定追踪的表达式在该步的值：[表达式, 显示用的值] */
  watches?: [string, string][];
  /** 到这一步为止标准输出有多少个字符 */
  out: number;
  ret?: string;
  exc?: string;
}
export interface PracticeTrace {
  steps: PracticeTraceStep[];
  /** 记满了步数，程序没跑完 */
  truncated: boolean;
  limit: number;
}
export interface PracticeCaseResult {
  index: number;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  stdout: string;
  error?: string;
  duration: number;
  trace?: PracticeTrace;
}
export interface CloudQuotaInfo {
  tier: "free" | "pro";
  founder: boolean;
  limit: number;
  used: number;
  remaining: number;
  day: string;
  resetAt: string;
  blockedReason?: "free_paused" | "account_too_new" | "quota_exceeded";
}
export interface PracticeRunResult {
  results: PracticeCaseResult[];
  duration: number;
  cancelled?: boolean;
  quota?: CloudQuotaInfo;
}
