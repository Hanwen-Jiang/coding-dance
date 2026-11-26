// 云端运行：交给远端运行器（tools/runner，集群节点经 Cloudflare Tunnel 接进来），经网站的 /api/run 转过去。
// 只能在云端跑的语言（Java、C++、Go 和后加的九种）总走这里；Python、JavaScript、TypeScript 默认在浏览器里跑，用户选了云端才走这里。
// 运行器只负责编译运行、给出每组的返回值和输出；对答案和浏览器里运行一样在这里做（comparePracticeOutput / parseAcmOutput）。
import { parseAcmOutput } from "./acm";
import { comparePracticeOutput } from "./compare";
import type { CloudQuotaInfo, PracticeCaseResult, PracticeLanguage, PracticeRunProgress, PracticeRunRequest, PracticeRunResult, PracticeTarget, PracticeTrace } from "./types";

/** 只能在云端运行的语言 */
export const REMOTE_LANGUAGES: PracticeLanguage[] = ["java", "cpp", "go", "c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart"];
export const isRemote = (language: PracticeLanguage) => REMOTE_LANGUAGES.includes(language);
/** 云端能调试的（真调试器：JDI、gdb、Delve）；其余云端语言只能运行。Python、JavaScript、TypeScript 选了云端也在浏览器里调试 */
export const REMOTE_DEBUG_LANGUAGES: PracticeLanguage[] = ["java", "cpp", "go"];
/** 这一次交给云端：只能在云端跑的语言；或者选了云端、又不是调试 */
export const runsInCloud = (language: PracticeLanguage, target: PracticeTarget | undefined, debug = false) =>
  isRemote(language) || (target === "cloud" && !debug);

/**
 * Python、JavaScript、TypeScript 在哪里运行，每门语言各记各的，存在这个浏览器里（默认浏览器）。
 * 只能在云端跑的语言总是 cloud。
 */
const TARGET_KEY = "hot100:practice:target:";
export function readTarget(language: PracticeLanguage): PracticeTarget {
  if (isRemote(language)) return "cloud";
  try { return localStorage.getItem(TARGET_KEY + language) === "cloud" ? "cloud" : "browser"; } catch { return "browser"; }
}
export function writeTarget(language: PracticeLanguage, target: PracticeTarget) {
  try { if (target === "cloud") localStorage.setItem(TARGET_KEY + language, "cloud"); else localStorage.removeItem(TARGET_KEY + language); } catch { /* 这次仍然生效 */ }
}

/** 云端运行要登录：没登录（或登录过期，/api/run 回 401）时抛这个，练习区据此显示登录提示 */
export class RemoteLoginError extends Error {
  constructor(message = "云端运行要先登录（用 GitHub 登录）") { super(message); this.name = "RemoteLoginError"; }
}
export type QuotaBlockCode = "free_paused" | "account_too_new" | "quota_exceeded";
const QUOTA_CODES = new Set<string>(["free_paused", "account_too_new", "quota_exceeded"]);
/** 云端额度用完、新账号受限或免费开关暂停时抛这个，练习区可提供换回浏览器运行按钮 */
export class RemoteQuotaError extends Error {
  code: QuotaBlockCode;
  quota?: CloudQuotaInfo;
  constructor(code: QuotaBlockCode, message: string, quota?: CloudQuotaInfo) {
    super(message);
    this.name = "RemoteQuotaError";
    this.code = code;
    this.quota = quota;
  }
}
/**
 * 有的语言要节点更新到带某一版改动的沙箱才交给云端（和 functions/_lib/runner.ts 的 LANG_FEATURES 一样）：
 * TypeScript 要 ts-transform（先查语法、能转换 enum），老节点上语法错误会变成每组一长串 Node 调用栈、enum 直接报错
 */
const LANG_FEATURES: Partial<Record<PracticeLanguage, string>> = { typescript: "ts-transform" };
/**
 * 云端还不能跑这门语言：运行器报的 langs 里没有它（节点还没更新到装了它的镜像），
 * 或者它要的 features 还没有（节点的沙箱还是旧版）
 */
export const remoteLacks = (status: RemoteStatus | null | undefined, language: PracticeLanguage) => {
  if (!status?.available) return false;
  if (status.langs && !status.langs.includes(language)) return true;
  const need = LANG_FEATURES[language];
  return !!need && !(status.features ?? []).includes(need);
};

interface RemoteCase { index: number; actual: unknown; stdout: string; stderr?: string; error?: string; duration: number; trace?: PracticeTrace }
interface RemoteReply { results?: RemoteCase[]; compileError?: string; compileMs?: number; runMs?: number; queueMs?: number; bootMs?: number; totalMs?: number; error?: string; code?: string; quota?: CloudQuotaInfo }

export interface RemoteStatus { available: boolean; reason?: string; langs?: string[]; debugLangs?: string[]; features?: string[]; quota?: CloudQuotaInfo }

/** 运行器在不在线（题目页打开练习区时问一次，缓存一分钟） */
let statusCache: { at: number; value: Promise<RemoteStatus> } | null = null;
let lastStatus: RemoteStatus | null = null;
export function remoteStatus(): Promise<RemoteStatus> {
  if (statusCache && Date.now() - statusCache.at < 60000) return statusCache.value;
  const value = fetch("/api/run", { cache: "no-store" })
    .then((r) => r.json() as Promise<RemoteStatus>)
    .then((s) => {
      lastStatus = s;
      return s;
    })
    .catch(() => ({ available: false, reason: "连不上网站的接口" }));
  statusCache = { at: Date.now(), value };
  return value;
}

function patchCachedQuota(quota?: CloudQuotaInfo) {
  if (!quota) return;
  if (lastStatus) lastStatus = { ...lastStatus, quota };
  if (!statusCache) return;
  const prev = statusCache.value;
  statusCache = { at: statusCache.at, value: prev.then((s) => ({ ...s, quota })) };
}

export async function runRemote(
  request: PracticeRunRequest,
  options: { signal?: AbortSignal; onStatus?: (s: string) => void; onProgress?: (p: PracticeRunProgress) => void } = {},
): Promise<PracticeRunResult> {
  if (!request.cases.length) throw new Error("请先添加测试用例");
  if (request.code.length > 100000) throw new Error("代码长度不能超过 100 KB");
  if (request.cases.length > 100) throw new Error("一次最多运行 100 个测试用例");
  const unavailable = request.mode === "leetcode" ? request.problem.leetcodeUnavailable?.[request.language] : undefined;
  if (unavailable) throw new Error(unavailable);
  if (request.debug && !REMOTE_DEBUG_LANGUAGES.includes(request.language)) throw new Error("这门语言暂时不能调试（云端只有 Java、C++、Go 接了调试器），可以先运行，用打印看中间结果");
  if (lastStatus && remoteLacks(lastStatus, request.language)) throw new Error(`云端运行器还没装上这门语言（节点正在更新），暂时不能运行，${isRemote(request.language) ? "稍后再试" : "可以先换回浏览器运行"}`);
  if (!statusCache || Date.now() - statusCache.at >= 60000) void remoteStatus();
  const started = performance.now();
  const compileStepLabel = isRemote(request.language) ? "云端编译" : "加载运行时";
  const stageLabels = [
    "核对云端额度与节点",
    "拉起隔离沙箱容器",
    `${compileStepLabel}与准备用例`,
    request.debug ? "单步录制变量轨迹" : `执行 ${request.cases.length} 组测试`,
  ];
  const emitStage = (elapsedMs: number) => {
    const step = elapsedMs < 450 ? 0 : elapsedMs < 1300 ? 1 : elapsedMs < 2400 ? 2 : 3;
    options.onStatus?.(`${stageLabels[step]}（${(elapsedMs / 1000).toFixed(1)}s）…`);
    options.onProgress?.({ step, totalSteps: 4, label: stageLabels[step], elapsedMs, cloud: true });
  };
  emitStage(0);
  const timer = setInterval(() => emitStage(performance.now() - started), 150);
  const body = {
    lang: request.language,
    mode: request.mode,
    code: request.code,
    ...(request.mode === "leetcode" ? { sig: request.problem.signature } : {}),
    cases: request.cases.map((c) => (request.mode === "acm" ? { stdin: c.stdin } : { input: c.input })),
    ...(request.debug ? { debug: true } : {}),
  };
  let res: Response;
  try {
    res = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: options.signal });
  } catch {
    clearInterval(timer);
    if (options.signal?.aborted) return { results: [], duration: performance.now() - started, cancelled: true };
    throw new Error("连不上云端运行器，检查一下网络再试");
  }
  clearInterval(timer);
  const reply = (await res.json().catch(() => ({}))) as RemoteReply;
  if (reply.quota) patchCachedQuota(reply.quota);
  if (res.status === 401) throw new RemoteLoginError(reply.error);
  if (reply.code && QUOTA_CODES.has(reply.code)) {
    throw new RemoteQuotaError(reply.code as QuotaBlockCode, reply.error || "云端运行额度受限", reply.quota);
  }
  if (!res.ok) throw new Error(reply.error || `云端运行失败（${res.status}）`);
  const results: PracticeCaseResult[] = (reply.results || []).map((r) => {
    const test = request.cases[r.index];
    const checked = test.expected !== undefined;
    let actual: unknown = r.actual, error = r.error;
    if (!error && request.mode === "acm") {
      if (!checked) actual = r.stdout;
      else {
        try { actual = parseAcmOutput(r.stdout, request.problem.signature); }
        catch (e) {
          const detail = e instanceof Error ? e.message : "请按题面输出答案。";
          error = r.stdout.trim() ? `标准输出格式不正确：${detail.replace("输入提前结束，请按题面补齐数据。", "输出提前结束，请按题面补齐结果。")}` : "程序没有输出，请先编写代码并输出答案。";
        }
      }
    }
    // 标准错误（cerr、System.err、panic 之前的打印）接在输出后面，方便看调试信息
    const stdout = r.stderr && !error ? `${r.stdout}${r.stdout && !r.stdout.endsWith("\n") ? "\n" : ""}[stderr]\n${r.stderr}` : r.stdout;
    return {
      index: r.index, actual, expected: test.expected, stdout, duration: r.duration,
      ...(error ? { error: r.stderr && error !== r.stderr && !error.includes(r.stderr) ? `${error}\n${r.stderr}` : error } : {}),
      ...(r.trace ? { trace: r.trace } : {}),
      passed: checked && !error && comparePracticeOutput(request.problem, test, actual),
    };
  });
  const timing =
    reply.bootMs != null || reply.compileMs != null || reply.runMs != null || reply.queueMs != null || reply.totalMs != null
      ? {
          ...(reply.queueMs != null ? { queueMs: reply.queueMs } : {}),
          ...(reply.bootMs != null ? { bootMs: reply.bootMs } : {}),
          ...(reply.compileMs != null ? { compileMs: reply.compileMs } : {}),
          ...(reply.runMs != null ? { runMs: reply.runMs } : {}),
          ...(reply.totalMs != null ? { totalMs: reply.totalMs } : {}),
        }
      : undefined;
  return { results, duration: performance.now() - started, ...(reply.quota ? { quota: reply.quota } : {}), ...(timing ? { timing } : {}) };
}
