export type PracticeLanguage = "python" | "javascript" | "typescript";
/** 编辑器补全：完整（关键字、内置函数、库函数、类型都提示）/ 无提示（只补全代码里已有的变量和函数） */
export type PracticeHints = "full" | "none";
export type PracticeMode = "leetcode" | "acm";
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
  /** Exact checked-in statement example, when this case comes from the problem document. */
  source?: { path: string; index: number; input: string; output: string };
}

export interface PracticeProblem {
  id: number;
  name: string;
  signature: PracticeSignature;
  parameterNames: string[];
  starters: Record<PracticeMode, Record<PracticeLanguage, string>>;
  cases: PracticeCase[];
  examples: PracticeCase[];
  /** FNV-1a of the previous generated ACM starters; only untouched defaults are migrated. */
  legacyAcmStarterHashes: Record<PracticeLanguage, string>;
  /** Other earlier untouched defaults, including the former short main/fs skeletons. */
  previousAcmStarterHashes: Record<PracticeLanguage, string[]>;
  /** 上一版力扣模式起始代码（带 from typing import * 和 raise / throw）的指纹：没改过的旧草稿换成新模板 */
  previousLeetcodeStarterHashes?: Record<PracticeLanguage, string[]>;
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
export interface PracticeRunResult {
  results: PracticeCaseResult[];
  duration: number;
  cancelled?: boolean;
}
