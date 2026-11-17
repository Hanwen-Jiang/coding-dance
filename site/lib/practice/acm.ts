import type { PracticeSignature } from "./types";

/** The ACM wire format is line based; strings occupy a whole line, including an empty line. */
export function arrayItem(type: string): string | null {
  if (type.endsWith("[]")) return type.slice(0, -2);
  return /^List<(.+)>$/.exec(type)?.[1] ?? null;
}
const atomArray = (type: string) => ["int", "long", "double", "bool", "char", "nullable-int"].includes(type);

export function outputType(signature: PracticeSignature): string {
  return signature.ret === "void" ? signature.params?.[signature.out ?? 0] ?? "void" : signature.ret ?? "void";
}

function atom(value: unknown, type: string): string {
  if (type === "NodeIndex") return value == null ? "-1" : String(value);
  if (value == null) return "null";
  if (type === "bool") return value ? "true" : "false";
  return String(value);
}

export function encodeAcmValue(value: unknown, type: string): string[] {
  if (type === "ListNode") return encodeAcmValue(value ?? [], "int[]");
  if (type === "TreeNode") return encodeAcmValue(value ?? [], "nullable-int[]");
  if (type === "CycleList" || type === "JoinList") {
    const pair = value as [unknown[], number];
    return [...encodeAcmValue(pair[0], "int[]"), String(pair[1] ?? -1)];
  }
  if (type === "RandomList") {
    const rows = value as [number, number | null][];
    return [String(rows.length), ...rows.map(([v, r]) => `${v} ${r == null ? -1 : r}`)];
  }
  const item = arrayItem(type);
  if (item) {
    const values = (value ?? []) as unknown[];
    if (atomArray(item)) return [String(values.length), ...(values.length ? [values.map((v) => atom(v, item)).join(" ")] : [])];
    return [String(values.length), ...values.flatMap((v) => encodeAcmValue(v, item))];
  }
  return [atom(value, type)];
}

class Reader {
  private lines: string[];
  private at = 0;
  constructor(text: string) {
    this.lines = text.replace(/\r/g, "").split("\n");
    if (text.endsWith("\n")) this.lines.pop();
  }
  line(): string {
    if (this.at >= this.lines.length) throw new Error("输入提前结束，请按题面补齐数据。");
    return this.lines[this.at++];
  }
  count(): number {
    const line = this.line().trim();
    if (!/^\d+$/.test(line)) throw new Error(`长度必须是非负整数，实际读到：${line}`);
    const n = Number(line);
    if (n > 100000) throw new Error("单个序列长度不能超过 100000。");
    return n;
  }
  tokens(n: number): string[] {
    const tokens: string[] = [];
    while (tokens.length < n) {
      const line = this.line().trim();
      if (line) tokens.push(...line.split(/\s+/));
    }
    if (tokens.length !== n) throw new Error(`序列声明了 ${n} 个元素，却读到 ${tokens.length} 个。`);
    return tokens;
  }
  done() {
    if (this.lines.slice(this.at).some((line) => line.trim())) throw new Error("输出包含多余内容；请仅输出题目要求的结果。");
  }
}

function parseAtom(text: string, type: string): unknown {
  const s = text.trim();
  if (type === "string") return text;
  if (type === "char") {
    if ([...text].length !== 1) throw new Error("字符必须恰好包含一个字符。");
    return text;
  }
  if (type === "void") {
    if (s !== "null") throw new Error("无返回值操作应输出 null。");
    return null;
  }
  if ((type === "TreeVal" || type === "nullable-int") && s === "null") return null;
  if (type === "NodeIndex" && (s === "-1" || s === "null")) return null;
  if (type === "bool") {
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
    throw new Error(`布尔值应为 true 或 false，实际读到：${s}`);
  }
  if (!s || !Number.isFinite(Number(s))) throw new Error(`应为数值，实际读到：${s}`);
  const n = Number(s);
  if (type !== "double" && !Number.isInteger(n)) throw new Error(`应为整数，实际读到：${s}`);
  return n;
}

function readValue(r: Reader, type: string): unknown {
  if (type === "ListNode") return readValue(r, "int[]");
  if (type === "TreeNode") return readValue(r, "nullable-int[]");
  if (type === "CycleList" || type === "JoinList") return [readValue(r, "int[]"), readValue(r, "int")];
  if (type === "RandomList") return Array.from({ length: r.count() }, () => {
    const row = r.tokens(2).map((x) => parseAtom(x, "int")) as number[];
    return [row[0], row[1] === -1 ? null : row[1]];
  });
  const item = arrayItem(type);
  if (item) {
    const n = r.count();
    return atomArray(item) ? r.tokens(n).map((x) => parseAtom(x, item)) : Array.from({ length: n }, () => readValue(r, item));
  }
  return parseAtom(r.line(), type);
}

export function encodeAcmInput(input: unknown[], signature: PracticeSignature): string {
  if (signature.cls) {
    const [ops, argv] = input as [string[], unknown[][]];
    return [String(ops.length), ...ops.map((op, i) => [op, ...argv[i].map((v) => String(v))].join(" "))].join("\n") + "\n";
  }
  return (signature.params ?? []).flatMap((t, i) => encodeAcmValue(input[i], t)).join("\n") + "\n";
}

export function decodeAcmInput(stdin: string, signature: PracticeSignature): unknown[] {
  const r = new Reader(stdin);
  if (signature.cls) {
    const n = r.count(), ops: string[] = [], argv: unknown[][] = [];
    for (let i = 0; i < n; i++) {
      const [op, ...tokens] = r.line().trim().split(/\s+/);
      const types = i === 0 && op === signature.cls ? signature.ctor ?? [] : signature.methods?.[op]?.[0];
      if (!types || (i === 0 && op !== signature.cls)) throw new Error(`无效操作：${op}。第一条必须是 ${signature.cls}。`);
      if (tokens.length !== types.length) throw new Error(`${op} 应有 ${types.length} 个参数。`);
      ops.push(op); argv.push(tokens.map((t, j) => parseAtom(t, types[j])));
    }
    r.done();
    return [ops, argv];
  }
  const input = (signature.params ?? []).map((t) => readValue(r, t));
  r.done();
  return input;
}

export function encodeAcmOutput(value: unknown, signature: PracticeSignature): string {
  if (signature.cls) return (value as unknown[]).map((v) => v == null ? "null" : String(v)).join("\n") + "\n";
  return encodeAcmValue(value, outputType(signature)).join("\n") + "\n";
}

export function parseAcmOutput(stdout: string, signature: PracticeSignature): unknown {
  if (signature.cls) return stdout.trim().split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const s = line.trim();
    if (s === "null") return null;
    if (s === "true" || s === "false") return s === "true";
    return parseAtom(s, "double");
  });
  const r = new Reader(stdout), value = readValue(r, outputType(signature));
  r.done();
  return value;
}
