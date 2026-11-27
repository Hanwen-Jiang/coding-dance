import type { PracticeLanguage, PracticeMode, PracticeSignature } from "./types";

export type DapStatus = "connecting" | "running" | "paused" | "terminated" | "error";

export interface DapWatchHistoryPoint {
  stop: number;
  line: number;
  value: string;
}

export interface DapWatchEntry {
  expr: string;
  value?: string;
  error?: string;
  history: DapWatchHistoryPoint[];
}

export interface DapSnapshot {
  status: DapStatus;
  lang: PracticeLanguage;
  mode: PracticeMode;
  code: string;
  label: string;
  sourceName: string;
  stopCount: number;
  line: number | null;
  reason?: string;
  stack: [string, number][];
  vars: [string, string][];
  changed: string[];
  watches: DapWatchEntry[];
  stdout: string;
  error?: string;
  frameId: number | null;
  threadId: number | null;
}

export interface DapClientOptions {
  url: string;
  lang: PracticeLanguage;
  mode: PracticeMode;
  code: string;
  label: string;
  sig?: PracticeSignature;
  stdin?: string;
  cases?: { input?: unknown[]; stdin?: string }[];
  breakpoints: number[];
  watch: string[];
  onUpdate: (snapshot: DapSnapshot) => void;
  WebSocketImpl?: typeof WebSocket;
}

export class DapConnectError extends Error {
  compileError: boolean;
  constructor(message: string, compileError = false) {
    super(message);
    this.name = "DapConnectError";
    this.compileError = compileError;
  }
}

interface DapMessage {
  seq?: number;
  type?: string;
  command?: string;
  request_seq?: number;
  success?: boolean;
  message?: string;
  body?: Record<string, unknown>;
  event?: string;
}

const MAX_STDOUT = 32768;
const MAX_HISTORY = 200;

function normalizeWatch(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const s = raw.trim();
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= 20) break;
  }
  return out;
}

function normalizeBreakpoints(lines: number[]): number[] {
  return [...new Set(lines.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
}

/**
 * 没有手动设断点时，自动找用户代码里第一行可执行语句作为入口断点，避免程序一跑到底直接退出。
 */
export function defaultEntryLine(code: string, lang: PracticeLanguage, mode: PracticeMode): number {
  const lines = code.replace(/\r\n?/g, "\n").split("\n");
  let inBlockComment = false;
  let pyDocstring: string | null = null;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    if (pyDocstring) {
      if (raw.includes(pyDocstring)) pyDocstring = null;
      continue;
    }
    if (inBlockComment) {
      if (raw.includes("*/")) inBlockComment = false;
      continue;
    }
    if (raw.startsWith("/*")) {
      if (!raw.includes("*/")) inBlockComment = true;
      continue;
    }
    if (raw.startsWith("//")) continue;

    if (lang === "python") {
      if (raw.startsWith("#")) continue;
      if ((raw.startsWith('"""') && !raw.slice(3).includes('"""')) || (raw.startsWith("'''") && !raw.slice(3).includes("'''"))) {
        pyDocstring = raw.slice(0, 3);
        continue;
      }
      if (/^(from\s+\S+\s+import|import\s+\S+)/.test(raw)) continue;
      if (/^@/.test(raw)) continue;
      if (/^class\s+\w+.*:$/.test(raw)) continue;
      if (/^(?:async\s+)?def\s+\w+\s*\(.*\)\s*(?:->\s*[^:]+)?\s*:$/.test(raw)) continue;
      if (/^if\s+__name__\s*==\s*['"]__main__['"]\s*:$/.test(raw)) continue;
      return i + 1;
    }

    if (lang === "ruby") {
      if (raw.startsWith("#")) continue;
      if (/^(require|require_relative|include|extend)\b/.test(raw)) continue;
      if (/^(?:class|module)\s+\w+/.test(raw)) continue;
      if (/^def\s+\S+/.test(raw)) continue;
      if (raw === "end") continue;
      return i + 1;
    }

    if (lang === "php") {
      if (raw.startsWith("#")) continue;
      if (/^(<\?php|\?>)$/.test(raw)) continue;
      if (/^(declare|namespace|use)\b/.test(raw)) continue;
      if (/^(?:final\s+|abstract\s+)?class\s+\w+/.test(raw)) {
        if (raw.includes("{")) braceDepth++;
        continue;
      }
      if (/^(?:public|private|protected|static|\s)*function\s+\w+\s*\([^;]*\)\s*(?::\s*[\w\\|?]+)?\s*\{?$/.test(raw)) {
        if (raw.includes("{")) braceDepth++;
        continue;
      }
      if (raw === "{" || raw === "}") {
        braceDepth += raw === "{" ? 1 : -1;
        continue;
      }
      return i + 1;
    }

    if (raw === "{" || raw === "}") {
      braceDepth += raw === "{" ? 1 : -1;
      continue;
    }

    if (lang === "java" || lang === "csharp") {
      if (lang === "java" && /^(package|import)\b/.test(raw)) continue;
      if (lang === "csharp" && /^(using|namespace)\b/.test(raw)) {
        if (raw.includes("{")) braceDepth++;
        continue;
      }
      if (mode === "leetcode" && braceDepth === 0 && /^(public\s+|internal\s+|private\s+|sealed\s+|partial\s+)*(class|struct)\b/.test(raw)) {
        if (raw.includes("{")) braceDepth++;
        continue;
      }
      if (raw.endsWith("{") && /^(public|private|protected|internal|static|virtual|override|async|\s)*[\w<>?\[\],\s]+\s+\w+\s*\([^;]*\)\s*\{$/.test(raw)) {
        braceDepth++;
        continue;
      }
    } else if (lang === "kotlin") {
      if (/^(package|import)\b/.test(raw)) continue;
      if (/^(?:class|object|interface)\s+\w+/.test(raw) && raw.endsWith("{")) {
        braceDepth++;
        continue;
      }
      if (/^(?:override\s+|private\s+|public\s+|internal\s+|suspend\s+)*fun\s+\w+.*\{$/.test(raw)) {
        braceDepth++;
        continue;
      }
    } else if (lang === "scala") {
      if (/^(package|import)\b/.test(raw)) continue;
      if (/^(?:case\s+)?(?:class|object|trait)\s+\w+/.test(raw) && raw.endsWith("{")) {
        braceDepth++;
        continue;
      }
      if (/^(?:override\s+|private\s+|protected\s+)*def\s+\w+.*=\s*\{$/.test(raw)) {
        braceDepth++;
        continue;
      }
    } else if (lang === "swift") {
      if (/^import\b/.test(raw)) continue;
      if (/^(?:final\s+|public\s+)?(?:class|struct|enum)\s+\w+/.test(raw) && raw.endsWith("{")) {
        braceDepth++;
        continue;
      }
      if (/^(?:mutating\s+|static\s+|class\s+|override\s+|public\s+|private\s+)*func\s+\w+.*\{$/.test(raw)) {
        braceDepth++;
        continue;
      }
    } else if (lang === "rust") {
      if (/^(use|mod)\b/.test(raw)) continue;
      if (/^(?:#\[.*\]|pub\s+)?(?:struct|enum|impl)\b/.test(raw) && raw.endsWith("{")) {
        braceDepth++;
        continue;
      }
      if (/^(?:pub\s+)?(?:async\s+)?fn\s+\w+.*\{$/.test(raw)) {
        braceDepth++;
        continue;
      }
    } else if (lang === "dart") {
      if (/^(import|export|library|part)\b/.test(raw)) continue;
      if (/^(?:abstract\s+)?class\s+\w+/.test(raw) && raw.endsWith("{")) {
        braceDepth++;
        continue;
      }
      if (raw.endsWith("{") && /^(?:static\s+|Future<.*?>\s+|void\s+|[\w<>?,\s]+\s+)?\w+\s*\([^;]*\)\s*(?:async\s*)?\{$/.test(raw)) {
        braceDepth++;
        continue;
      }
    } else if (lang === "javascript" || lang === "typescript") {
      if (/^(import|export\s+(?:type\s+)?\{|use\s+strict)/.test(raw) || raw === "'use strict';" || raw === '"use strict";') continue;
      if (/^(?:export\s+)?(?:default\s+)?(?:class|interface|type)\s+\w+/.test(raw) && raw.endsWith("{")) {
        braceDepth++;
        continue;
      }
      if (/^(?:export\s+)?(?:async\s+)?function\b.*\{$/.test(raw) || /^(?:var|let|const)\s+\w+.*=\s*(?:async\s+)?function\b.*\{$/.test(raw) || /^(?:var|let|const)\s+\w+.*=\s*(?:async\s+)?\([^)]*\).*=>\s*\{$/.test(raw)) {
        braceDepth++;
        continue;
      }
    } else if (lang === "go") {
      if (/^package\b/.test(raw)) continue;
      if (/^import\s*\(/.test(raw)) {
        // Skip multi-line import block until ')'
        while (i + 1 < lines.length && !lines[i].includes(")")) i++;
        continue;
      }
      if (/^import\b/.test(raw)) continue;
      if (/^func\s+(?:\([^)]*\)\s*)?\w+\s*\([^;]*\)[^{]*\{$/.test(raw)) {
        braceDepth++;
        continue;
      }
    } else if (lang === "cpp" || lang === "c") {
      if (/^#(include|define|pragma|if|ifdef|ifndef|endif)\b/.test(raw) || /^using\s+namespace\b/.test(raw)) continue;
      if (/^(public|private|protected)\s*:$/.test(raw)) continue;
      if (/^(class|struct)\s+\w+/.test(raw) && raw.endsWith("{")) {
        braceDepth++;
        continue;
      }
      if (raw.endsWith("{") && /^(?:public:|private:|protected:)?\s*[\w:<>&*\s]+\s+\w+\s*\([^;]*\)\s*(?:const)?\s*\{$/.test(raw)) {
        braceDepth++;
        continue;
      }
    }

    return i + 1;
  }
  return 1;
}

export class DapClient {
  private ws: WebSocket | null = null;
  private seq = 1;
  private pending = new Map<number, { resolve: (msg: DapMessage) => void; reject: (err: Error) => void }>();
  private readySettled = false;
  private readyResolve!: () => void;
  private readyReject!: (err: Error) => void;
  readonly readyPromise: Promise<void>;

  private closed = false;
  private configured = false;
  private breakpoints: number[];
  private watch: string[];
  private historyMap = new Map<string, DapWatchHistoryPoint[]>();
  private prevVars = new Map<string, string>();
  private snapshot: DapSnapshot;
  private onUpdate: (snapshot: DapSnapshot) => void;
  private stopQueue: Promise<void> = Promise.resolve();

  constructor(opts: DapClientOptions) {
    this.breakpoints = normalizeBreakpoints(opts.breakpoints);
    this.watch = normalizeWatch(opts.watch);
    this.onUpdate = opts.onUpdate;
    this.snapshot = {
      status: "connecting",
      lang: opts.lang,
      mode: opts.mode,
      code: opts.code,
      label: opts.label,
      sourceName: "",
      stopCount: 0,
      line: null,
      stack: [],
      vars: [],
      changed: [],
      watches: this.watch.map((expr) => ({ expr, history: [] })),
      stdout: "",
      frameId: null,
      threadId: null,
    };
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.emit();
    this.connect(opts);
  }

  private emit() {
    this.onUpdate({
      ...this.snapshot,
      stack: [...this.snapshot.stack],
      vars: [...this.snapshot.vars],
      changed: [...this.snapshot.changed],
      watches: this.snapshot.watches.map((w) => ({ ...w, history: [...w.history] })),
    });
  }

  private connect(opts: DapClientOptions) {
    const WS = opts.WebSocketImpl ?? WebSocket;
    let opened = false;
    const ws = new WS(opts.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      opened = true;
      if (this.closed) return;
      ws.send(JSON.stringify({
        type: "init",
        lang: opts.lang,
        mode: opts.mode,
        code: opts.code,
        ...(opts.sig ? { sig: opts.sig } : {}),
        ...(opts.stdin !== undefined ? { stdin: opts.stdin } : {}),
        ...(opts.cases ? { cases: opts.cases } : {}),
      }));
    });

    ws.addEventListener("message", (event) => {
      if (this.closed) return;
      let msg: DapMessage & { sourceName?: string; compileError?: string; error?: string };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (!this.readySettled) {
        if (msg.type === "compile_error") {
          const message = msg.error || `编译出错：\n${msg.compileError || ""}`;
          this.fail(message, true);
          return;
        }
        if (msg.type === "error") {
          this.fail(msg.error || "云端调试启动失败", false);
          return;
        }
        if (msg.type === "ready") {
          this.readySettled = true;
          this.snapshot.sourceName = msg.sourceName || "";
          this.snapshot.status = "running";
          this.emit();
          this.readyResolve();
          void this.handshake(opts);
          return;
        }
      }

      if (msg.type === "response" && typeof msg.request_seq === "number") {
        const waiter = this.pending.get(msg.request_seq);
        if (waiter) {
          this.pending.delete(msg.request_seq);
          if (msg.success === false) waiter.reject(new Error(msg.message || `${msg.command || "DAP"} 请求失败`));
          else waiter.resolve(msg);
        }
        return;
      }

      if (msg.type === "event") {
        this.handleEvent(msg);
      }
    });

    ws.addEventListener("error", () => {
      if (this.closed) return;
      this.fail(opened ? "调试连接中断" : "无法连接云端调试服务", false);
    });

    ws.addEventListener("close", () => {
      for (const [, waiter] of this.pending) waiter.reject(new Error("调试会话已关闭"));
      this.pending.clear();
      if (!this.readySettled && !this.closed) {
        this.fail("调试连接在就绪前关闭", false);
        return;
      }
      if (!this.closed && this.snapshot.status !== "error" && this.snapshot.status !== "terminated") {
        this.snapshot.status = "terminated";
        this.snapshot.frameId = null;
        this.emit();
      }
    });
  }

  private fail(message: string, compileError: boolean) {
    this.snapshot.status = "error";
    this.snapshot.error = message;
    this.snapshot.frameId = null;
    this.emit();
    if (!this.readySettled) {
      this.readySettled = true;
      this.readyReject(new DapConnectError(message, compileError));
    }
    this.closeSocket();
  }

  private closeSocket() {
    this.closed = true;
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
  }

  private sendRequest(command: string, args: Record<string, unknown> = {}): Promise<DapMessage> {
    if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("调试会话未连接"));
    }
    const seq = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(seq, { resolve, reject });
      this.ws!.send(JSON.stringify({ seq, type: "request", command, arguments: args }));
    });
  }

  private async handshake(opts: DapClientOptions) {
    try {
      await this.sendRequest("initialize", {
        clientID: "coding-dance",
        adapterID: "coding-dance",
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: "path",
        supportsVariableType: true,
      });
      await this.sendRequest("launch", {
        stopOnEntry: false,
        stopAtBeginningOfMainSubprogram: false,
      });
      const initialLines = this.breakpoints.length
        ? this.breakpoints
        : [defaultEntryLine(opts.code, opts.lang, opts.mode)];
      await this.sendRequest("setBreakpoints", {
        source: { name: this.snapshot.sourceName },
        breakpoints: initialLines.map((line) => ({ line })),
      });
      this.configured = true;
      await this.sendRequest("configurationDone");
    } catch (e) {
      if (this.canReportError()) {
        this.snapshot.status = "error";
        this.snapshot.error = e instanceof Error ? e.message : String(e);
        this.emit();
      }
    }
  }

  private canReportError(): boolean {
    return !this.closed && this.snapshot.status !== "terminated";
  }

  private handleEvent(msg: DapMessage) {
    const body = msg.body || {};
    if (msg.event === "output") {
      const chunk = typeof body.output === "string" ? body.output : "";
      if (chunk) {
        const next = this.snapshot.stdout + chunk;
        this.snapshot.stdout = next.length > MAX_STDOUT ? next.slice(next.length - MAX_STDOUT) : next;
        this.emit();
      }
      return;
    }
    if (msg.event === "continued") {
      this.snapshot.status = "running";
      this.snapshot.frameId = null;
      this.emit();
      return;
    }
    if (msg.event === "terminated" || msg.event === "exited") {
      const errMsg = typeof body.error === "string" ? body.error : undefined;
      this.snapshot.status = errMsg ? "error" : "terminated";
      if (errMsg) this.snapshot.error = errMsg;
      this.snapshot.frameId = null;
      this.emit();
      this.closeSocket();
      return;
    }
    if (msg.event === "stopped") {
      this.stopQueue = this.stopQueue.then(() => this.onStopped(body));
    }
  }

  private async onStopped(body: Record<string, unknown>) {
    if (this.closed) return;
    try {
      let threadId = typeof body.threadId === "number" ? body.threadId : this.snapshot.threadId;
      if (threadId == null) {
        const tr = await this.sendRequest("threads");
        const threads = (tr.body?.threads as { id?: number }[] | undefined) || [];
        if (threads.length && typeof threads[0].id === "number") threadId = threads[0].id;
      }
      if (threadId == null) return;

      const st = await this.sendRequest("stackTrace", { threadId, startFrame: 0, levels: 20 });
      const rawFrames = (st.body?.stackFrames as { id?: number; name?: string; line?: number; source?: { name?: string; path?: string } }[] | undefined) || [];
      const srcName = this.snapshot.sourceName;
      const isUser = (f: { source?: { name?: string; path?: string } }) =>
        !!srcName && (f.source?.name === srcName || !!f.source?.path?.endsWith(`/${srcName}`) || f.source?.path === srcName);
      const userFrames = rawFrames.filter((f) => isUser(f) && typeof f.line === "number" && f.line > 0);
      const frames = userFrames.length ? userFrames : rawFrames.filter((f) => typeof f.line === "number" && f.line > 0);
      const top = frames[0] || rawFrames[0];

      const stopCount = this.snapshot.stopCount + 1;
      const line = top && typeof top.line === "number" && top.line > 0 ? top.line : null;
      const frameId = top && typeof top.id === "number" ? top.id : null;
      const stack: [string, number][] = frames.map((f) => [f.name || "(frame)", f.line || 0]);

      let vars: [string, string][] = [];
      if (frameId != null) {
        const sc = await this.sendRequest("scopes", { frameId });
        const scopes = (sc.body?.scopes as { variablesReference?: number; expensive?: boolean }[] | undefined) || [];
        const activeScopes = scopes.filter((s) => !s.expensive && (s.variablesReference || 0) > 0);
        const targetScopes = activeScopes.length ? activeScopes : scopes.filter((s) => (s.variablesReference || 0) > 0).slice(0, 1);
        const seenVars = new Set<string>();
        for (const scope of targetScopes) {
          if (vars.length >= 50 || !scope.variablesReference) break;
          const vr = await this.sendRequest("variables", { variablesReference: scope.variablesReference });
          const rawVars = (vr.body?.variables as { name?: string; value?: string; type?: string }[] | undefined) || [];
          for (const v of rawVars) {
            if (typeof v.name !== "string" || !v.name || seenVars.has(v.name)) continue;
            seenVars.add(v.name);
            vars.push([v.name, String(v.value ?? "")]);
            if (vars.length >= 50) break;
          }
        }
      }

      const changed = this.snapshot.stopCount > 0
        ? vars.filter(([k, v]) => this.prevVars.get(k) !== v).map(([k]) => k)
        : [];
      this.prevVars = new Map(vars);

      const watches = await this.evaluateWatchList(this.watch, frameId, stopCount, line ?? 0);

      this.snapshot = {
        ...this.snapshot,
        status: "paused",
        stopCount,
        line,
        reason: typeof body.reason === "string" ? body.reason : "breakpoint",
        stack,
        vars,
        changed,
        watches,
        frameId,
        threadId,
      };
      this.emit();
    } catch (e) {
      if (!this.closed) {
        this.snapshot.status = "error";
        this.snapshot.error = e instanceof Error ? e.message : String(e);
        this.emit();
      }
    }
  }

  private async evaluateWatchList(exprs: string[], frameId: number | null, stopCount: number, line: number): Promise<DapWatchEntry[]> {
    const out: DapWatchEntry[] = [];
    for (const expr of exprs) {
      const history = this.historyMap.get(expr) ?? [];
      if (frameId == null) {
        out.push({ expr, history });
        continue;
      }
      try {
        const res = await this.sendRequest("evaluate", { expression: expr, frameId, context: "watch" });
        const result = res.body?.result !== undefined ? String(res.body.result) : "";
        const lastPt = history[history.length - 1];
        if (!lastPt || lastPt.value !== result) {
          if (history.length < MAX_HISTORY) {
            history.push({ stop: stopCount, line, value: result });
          }
          this.historyMap.set(expr, history);
        }
        out.push({ expr, value: result, history });
      } catch (e) {
        out.push({ expr, error: e instanceof Error ? e.message : String(e), history });
      }
    }
    return out;
  }

  private async stepCommand(command: "continue" | "next" | "stepIn" | "stepOut") {
    if (this.closed || this.snapshot.status !== "paused" || this.snapshot.threadId == null) return;
    const threadId = this.snapshot.threadId;
    this.snapshot.status = "running";
    this.snapshot.frameId = null;
    this.emit();
    try {
      await this.sendRequest(command, { threadId });
    } catch (e) {
      if (this.canReportError()) {
        this.snapshot.status = "error";
        this.snapshot.error = e instanceof Error ? e.message : String(e);
        this.emit();
      }
    }
  }

  continue() { return this.stepCommand("continue"); }
  next() { return this.stepCommand("next"); }
  stepIn() { return this.stepCommand("stepIn"); }
  stepOut() { return this.stepCommand("stepOut"); }

  async setBreakpoints(lines: number[]) {
    this.breakpoints = normalizeBreakpoints(lines);
    if (!this.configured || this.closed) return;
    try {
      await this.sendRequest("setBreakpoints", {
        source: { name: this.snapshot.sourceName },
        breakpoints: this.breakpoints.map((line) => ({ line })),
      });
    } catch { /* ignore transient breakpoint update failure */ }
  }

  async setWatch(exprs: string[]) {
    this.watch = normalizeWatch(exprs);
    if (this.closed) return;
    if (this.snapshot.status === "paused" && this.snapshot.frameId != null) {
      const watches = await this.evaluateWatchList(
        this.watch,
        this.snapshot.frameId,
        this.snapshot.stopCount,
        this.snapshot.line ?? 0,
      );
      this.snapshot = { ...this.snapshot, watches };
      this.emit();
      return;
    }
    this.snapshot = {
      ...this.snapshot,
      watches: this.watch.map((expr) => ({ expr, history: this.historyMap.get(expr) ?? [] })),
    };
    this.emit();
  }

  disconnect() {
    if (this.closed) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const seq = this.seq++;
        this.ws.send(JSON.stringify({ seq, type: "request", command: "disconnect", arguments: { terminateDebuggee: true } }));
      } catch { /* ignore */ }
    }
    if (!this.readySettled) {
      this.readySettled = true;
      this.readyReject(new DapConnectError("调试已停止", false));
    }
    if (this.snapshot.status !== "error") {
      this.snapshot.status = "terminated";
      this.snapshot.frameId = null;
      this.emit();
    }
    this.closeSocket();
  }
}
