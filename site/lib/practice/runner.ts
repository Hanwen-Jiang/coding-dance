import { parseAcmOutput } from "./acm";
import { comparePracticeOutput } from "./compare";
import { runRemote, runsInCloud } from "./remote";
import type { PracticeCaseResult, PracticeRunRequest, PracticeRunResult } from "./types";

export type { PracticeCaseResult, PracticeRunResult } from "./types";
export type RunCaseResult = PracticeCaseResult;
export type RunResult = PracticeRunResult;
export type RuntimeStatus = string;
export interface PracticeRunOptions {
  signal?: AbortSignal;
  onStatus?: (status: RuntimeStatus) => void;
  /** Test override; normal runs allow three seconds for each test after initialization. */
  timeoutMs?: number;
}

/** Versioned runtime paths under /practice-runtime/ (copied by tools/practice-runtime/prepare.mjs, cached for a year). */
const VENDOR = {
  pyodide: `vendor/pyodide/${process.env.PRACTICE_PYODIDE_VERSION}/`,
  typescript: `vendor/typescript/${process.env.PRACTICE_TYPESCRIPT_VERSION}/typescript.js`,
};

/**
 * Opaque iframe + disposable Worker: user programs never share the site's origin.
 * 只能在云端跑的语言、和选了云端的 Python / JavaScript / TypeScript（调试除外）交给云端（remote.ts）。
 */
export async function runPractice(request: PracticeRunRequest, options: PracticeRunOptions = {}): Promise<PracticeRunResult> {
  if (runsInCloud(request.language, request.target, request.debug)) return runRemote(request, options);
  if (typeof document === "undefined") throw new Error("代码运行需要浏览器环境");
  if (!request.cases.length) throw new Error("请先添加测试用例");
  if (request.code.length > 100000) throw new Error("代码长度不能超过 100 KB");
  if (request.cases.length > 100) throw new Error("一次最多运行 100 个测试用例");
  const started = performance.now(), results: PracticeCaseResult[] = [];
  if (options.signal?.aborted) return { results, duration: 0, cancelled: true };
  // 调试时每一行都要记变量，慢得多：每组用例多给一些时间（记满步数会自己停下）
  const caseLimit = options.timeoutMs ?? (request.debug ? 15000 : 3000);
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe"), channel = new MessageChannel();
    const base = new URL("/practice-runtime/", location.href).href;
    iframe.sandbox.add("allow-scripts"); iframe.hidden = true; iframe.title = "代码运行隔离环境"; iframe.setAttribute("aria-hidden", "true");
    let timer: ReturnType<typeof setTimeout>, done = false, index = 0, connected = false;
    const finish = (cancelled = false) => {
      if (done) return; done = true; clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      window.removeEventListener("message", ready);
      channel.port1.postMessage({ type: "stop" }); channel.port1.close(); channel.port2.close(); iframe.remove();
      resolve({ results, duration: performance.now() - started, ...(cancelled ? { cancelled: true } : {}) });
    };
    const fail = (error: string) => {
      const test = request.cases[index];
      if (test && !results.some((r) => r.index === index)) results.push({ index, passed: false, actual: null, expected: test.expected, stdout: "", error, duration: caseLimit });
      finish();
    };
    const timeout = (ms: number, message: string) => { clearTimeout(timer); timer = setTimeout(() => fail(message), ms); };
    const cancel = () => finish(true);
    const ready = (event: MessageEvent) => {
      if (connected || event.source !== iframe.contentWindow || event.data?.type !== "practice-frame-ready") return;
      connected = true;
      iframe.contentWindow!.postMessage({ type: "practice-connect", base }, "*", [channel.port2]);
    };
    channel.port1.onmessage = (event: MessageEvent) => {
      if (done) return;
      const message = event.data;
      if (message.type === "connected") channel.port1.postMessage({ type: "init", base, vendor: VENDOR, language: request.language, debug: !!request.debug });
      else if (message.type === "status") options.onStatus?.(message.text);
      else if (message.type === "ready") {
        options.onStatus?.("正在运行测试…");
        channel.port1.postMessage({ type: "run", code: request.code, mode: request.mode, signature: request.problem.signature, cases: request.cases.map(({ input, stdin }) => ({ input, stdin })), debug: !!request.debug, ...(request.debug && request.watch?.length ? { watch: request.watch } : {}) });
        timeout(caseLimit, "运行超时，请检查是否存在死循环或复杂度过高");
      } else if (message.type === "case-start") {
        index = message.index;
        timeout(caseLimit, "运行超时，请检查是否存在死循环或复杂度过高");
        options.onStatus?.(`正在运行测试 ${index + 1} / ${request.cases.length}…`);
      } else if (message.type === "case-result") {
        const test = request.cases[message.index]; if (!test) return;
        let actual: unknown = message.actual, error: string | undefined = message.error;
        const checked = test.expected !== undefined;
        if (!error && request.mode === "acm" && !checked) actual = String(message.stdout || "");
        if (!error && request.mode === "acm" && checked) {
          try { actual = parseAcmOutput(message.stdout, request.problem.signature); }
          catch (e) {
            const detail = e instanceof Error ? e.message : "请按题面输出答案。";
            error = String(message.stdout || "").trim() ? `标准输出格式不正确：${detail.replace("输入提前结束，请按题面补齐数据。", "输出提前结束，请按题面补齐结果。")}` : "程序没有输出，请先编写代码并输出答案。";
          }
        }
        results.push({ index: message.index, actual, expected: test.expected, stdout: String(message.stdout || "").slice(0, 16384), ...(error ? { error } : {}), ...(message.trace ? { trace: message.trace } : {}), passed: checked && !error && comparePracticeOutput(request.problem, test, actual), duration: message.duration });
      } else if (message.type === "done") finish();
      else if (message.type === "fatal") fail(String(message.error));
    };
    channel.port1.start();
    options.signal?.addEventListener("abort", cancel, { once: true });
    window.addEventListener("message", ready);
    timeout(90000, "运行环境加载超时，请检查本地资源是否完整并重试");
    options.onStatus?.(request.language === "python" ? "正在准备 Python 环境…" : "正在准备执行环境…");
    iframe.srcdoc = `<!doctype html><meta charset="utf-8"><script src="${base}bridge.js"></script>`;
    document.body.appendChild(iframe);
  });
}
