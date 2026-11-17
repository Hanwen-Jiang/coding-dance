export type PracticeLanguage = "python" | "javascript" | "typescript";
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
}
export interface PracticeCaseResult {
  index: number;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  stdout: string;
  error?: string;
  duration: number;
}
export interface PracticeRunResult {
  results: PracticeCaseResult[];
  duration: number;
  cancelled?: boolean;
}
