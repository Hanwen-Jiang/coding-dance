// 云端运行：Java / C++ / Go 交给远端运行器（tools/runner，部署在 win-gw-lou 的虚拟机里），经网站的 /api/run 转过去。
// 运行器只负责编译运行、给出每组的返回值和输出；对答案和浏览器里运行一样在这里做（comparePracticeOutput / parseAcmOutput）。
import { parseAcmOutput } from "./acm";
import { comparePracticeOutput } from "./compare";
import type { PracticeCaseResult, PracticeLanguage, PracticeRunRequest, PracticeRunResult, PracticeTrace } from "./types";

export const REMOTE_LANGUAGES: PracticeLanguage[] = ["java", "cpp", "go"];
export const isRemote = (language: PracticeLanguage) => REMOTE_LANGUAGES.includes(language);

interface RemoteCase { index: number; actual: unknown; stdout: string; stderr?: string; error?: string; duration: number; trace?: PracticeTrace }
interface RemoteReply { results?: RemoteCase[]; compileError?: string; compileMs?: number; runMs?: number; queueMs?: number; error?: string }

export interface RemoteStatus { available: boolean; reason?: string; langs?: string[]; debugLangs?: string[] }

/** 运行器在不在线（题目页打开练习区时问一次，缓存一分钟） */
let statusCache: { at: number; value: Promise<RemoteStatus> } | null = null;
export function remoteStatus(): Promise<RemoteStatus> {
  if (statusCache && Date.now() - statusCache.at < 60000) return statusCache.value;
  const value = fetch("/api/run", { cache: "no-store" })
    .then((r) => r.json() as Promise<RemoteStatus>)
    .catch(() => ({ available: false, reason: "连不上网站的接口" }));
  statusCache = { at: Date.now(), value };
  return value;
}

export async function runRemote(request: PracticeRunRequest, options: { signal?: AbortSignal; onStatus?: (s: string) => void } = {}): Promise<PracticeRunResult> {
  if (!request.cases.length) throw new Error("请先添加测试用例");
  if (request.code.length > 100000) throw new Error("代码长度不能超过 100 KB");
  if (request.cases.length > 100) throw new Error("一次最多运行 100 个测试用例");
  const started = performance.now();
  options.onStatus?.(request.debug ? "正在云端调试：编译、在调试器里一步步记下来…" : "正在云端编译运行…");
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
  } catch (e) {
    if (options.signal?.aborted) return { results: [], duration: performance.now() - started, cancelled: true };
    throw new Error("连不上云端运行器，检查一下网络再试");
  }
  const reply = (await res.json().catch(() => ({}))) as RemoteReply;
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
  return { results, duration: performance.now() - started };
}
