import type { PracticeCase, PracticeProblem } from "./types";

export type PracticeInputField = { key: string; label: string; value: string };

/** 一维数组保持一行；二维答案每行一个子数组，不把每个数展开成一行。 */
export function formatPracticeValue(value: unknown): string {
  if (value === undefined) return "（未设置）";
  if (!Array.isArray(value)) return JSON.stringify(value) ?? String(value);
  if (!value.some((item) => Array.isArray(item) || (item !== null && typeof item === "object"))) return JSON.stringify(value);
  if (!value.length) return "[]";
  return `[\n${value.map((item) => `  ${JSON.stringify(item)}`).join(",\n")}\n]`;
}

export function practiceInputFields(problem: PracticeProblem, input: unknown[]): PracticeInputField[] {
  if (problem.signature.cls) return [
    { key: "param:0", label: "operations", value: JSON.stringify(input[0]) },
    { key: "param:1", label: "arguments", value: JSON.stringify(input[1]) },
  ];
  return (problem.signature.params ?? []).flatMap((type, index): PracticeInputField[] => {
    const name = problem.parameterNames[index] || `arg${index + 1}`;
    if (type === "CycleList") {
      const [values, pos] = input[index] as [unknown[], number];
      return [{ key: `cycle:${index}:values`, label: name, value: JSON.stringify(values) }, { key: `cycle:${index}:pos`, label: "pos", value: String(pos) }];
    }
    if (type === "JoinList") {
      const [prefix, shared] = input[index] as [unknown[], number];
      const previous = input[index - 1] as unknown[];
      return [
        { key: `join:${index}:list`, label: name, value: JSON.stringify([...prefix, ...(shared < 0 ? [] : previous.slice(shared))]) },
        { key: `join:${index}:skipA`, label: "skipA", value: String(shared) },
        { key: `join:${index}:skipB`, label: "skipB", value: String(prefix.length) },
      ];
    }
    return [{ key: `param:${index}`, label: name, value: JSON.stringify(input[index]) }];
  });
}

/** 官方示例使用题面里的变量名；隐藏的判题表示只用于传给 runner。 */
export function formatPracticeInput(problem: PracticeProblem, test: PracticeCase): string {
  if (test.source?.input && !problem.signature.cls) {
    return test.source.input.trim().replace(/,\s*([A-Za-z_]\w*\s*=)/g, "\n$1");
  }
  const fields = practiceInputFields(problem, test.input);
  const formatted = fields.map((field) => `${field.label} = ${field.value}`);
  const join = problem.signature.params?.indexOf("JoinList") ?? -1;
  if (join >= 0) {
    const [, shared] = test.input[join] as [unknown[], number];
    const previous = test.input[join - 1] as unknown[];
    formatted.push(`intersectVal = ${shared < 0 ? 0 : JSON.stringify(previous[shared])}`);
  }
  return formatted.join("\n");
}

export function formatPracticeResult(problem: PracticeProblem, value: unknown): string {
  if (problem.signature.ret === "NodeIndex") return value == null ? "null（没有返回节点）" : `返回节点下标：${value}（从 0 开始）`;
  return formatPracticeValue(value);
}

export function parsePracticeFields(problem: PracticeProblem, fields: PracticeInputField[]): unknown[] {
  const values = new Map(fields.map((field) => {
    try { return [field.key, JSON.parse(field.value)] as const; }
    catch { throw new Error(`${field.label} 不是有效的 JSON。字符串请使用双引号。`); }
  }));
  if (problem.signature.cls) {
    const input = [values.get("param:0"), values.get("param:1")];
    if (!Array.isArray(input[0]) || !Array.isArray(input[1]) || input[0].length !== input[1].length) throw new Error("operations 和 arguments 都需要是数组，且长度相同。");
    return input;
  }
  return (problem.signature.params ?? []).map((type, index) => {
    if (type === "CycleList") {
      const head = values.get(`cycle:${index}:values`), pos = values.get(`cycle:${index}:pos`);
      if (!Array.isArray(head) || !Number.isInteger(pos) || (pos as number) < -1 || (pos as number) >= head.length) throw new Error("head 需要是数组，pos 需为 -1 或有效节点下标。");
      return [head, pos];
    }
    if (type === "JoinList") {
      const list = values.get(`join:${index}:list`), skipA = values.get(`join:${index}:skipA`) as number, skipB = values.get(`join:${index}:skipB`) as number;
      const first = values.get(`param:${index - 1}`);
      if (!Array.isArray(list) || !Array.isArray(first) || !Number.isInteger(skipA) || !Number.isInteger(skipB) || skipA < -1 || skipA >= first.length || skipB < 0 || skipB > list.length) throw new Error("请检查完整链表与 skipA / skipB 下标；无相交时 skipA 填 -1。");
      if (skipA >= 0 && JSON.stringify(first.slice(skipA)) !== JSON.stringify(list.slice(skipB))) throw new Error("从 skipA 和 skipB 起的公共后缀需要相同。");
      return [skipA < 0 ? list : list.slice(0, skipB), skipA];
    }
    return values.get(`param:${index}`);
  });
}

export function starterHash(code: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) hash = Math.imul(hash ^ code.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
