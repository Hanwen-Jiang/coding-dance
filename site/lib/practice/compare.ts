import type { PracticeCase, PracticeProblem } from "./types";

function equal(a: unknown, b: unknown, floating = false): boolean {
  if (typeof a === "number" && typeof b === "number") return Number.isFinite(a) && Number.isFinite(b) && (floating ? Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)) : a === b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i], floating));
  return a === b;
}

function sorted(values: unknown[]): unknown[] {
  return values.slice().sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** Accept valid alternative answers rather than requiring the reference's tie-breaking. */
export function comparePracticeOutput(problem: Pick<PracticeProblem, "id" | "signature">, test: Pick<PracticeCase, "input" | "expected">, actual: unknown): boolean {
  const { input, expected } = test;
  const floating = !!problem.signature.ret?.includes("double") || Object.values(problem.signature.methods ?? {}).some(([, ret]) => ret.includes("double"));
  if (problem.id === 1) {
    if (!Array.isArray(actual) || actual.length !== 2 || !Array.isArray(input[0])) return false;
    const [i, j] = actual;
    const nums = input[0] as number[];
    return Number.isInteger(i) && Number.isInteger(j) && i !== j && i >= 0 && j >= 0 && i < nums.length && j < nums.length && nums[i] + nums[j] === input[1];
  }
  if (problem.id === 5) {
    return typeof actual === "string" && typeof expected === "string" && typeof input[0] === "string" && actual.length === expected.length && input[0].includes(actual) && actual === [...actual].reverse().join("");
  }
  if (problem.id === 76) {
    if (typeof actual !== "string" || typeof expected !== "string" || typeof input[0] !== "string" || typeof input[1] !== "string") return false;
    if (actual.length !== expected.length || !input[0].includes(actual)) return false;
    if (!actual && !expected) return true;
    const counts = new Map<string, number>();
    for (const c of actual) counts.set(c, (counts.get(c) ?? 0) + 1);
    for (const c of input[1]) { const n = counts.get(c) ?? 0; if (!n) return false; counts.set(c, n - 1); }
    return true;
  }
  // top-k may contain a different element at a frequency tie.
  if (problem.id === 347 && Array.isArray(input[0]) && typeof input[1] === "number") {
    if (!Array.isArray(actual) || actual.length !== input[1] || new Set(actual).size !== actual.length) return false;
    const counts = new Map<unknown, number>();
    for (const value of input[0]) counts.set(value, (counts.get(value) ?? 0) + 1);
    const threshold = [...counts.values()].sort((a, b) => b - a)[input[1] - 1];
    const required = [...counts.entries()].filter(([, n]) => n > threshold).map(([v]) => v);
    return actual.every((v) => counts.has(v) && counts.get(v)! >= threshold) && required.every((v) => actual.includes(v));
  }
  if (problem.id === 108) {
    if (!Array.isArray(actual) || !Array.isArray(input[0]) || actual.length > 100000) return false;
    const nodes: { value: unknown; left?: number; right?: number }[] = [];
    if (actual.length && actual[0] !== null) nodes.push({ value: actual[0] });
    let i = 1;
    for (let n = 0; n < nodes.length && i < actual.length; n++) for (const side of ["left", "right"] as const) {
      if (i >= actual.length) break;
      const value = actual[i++];
      if (value !== null) { nodes[n][side] = nodes.length; nodes.push({ value }); }
    }
    if (actual.slice(i).some((v) => v !== null)) return false;
    const heights = new Array<number>(nodes.length), inorder: unknown[] = [], stack: number[] = [];
    for (let n = nodes.length - 1; n >= 0; n--) {
      const left = nodes[n].left === undefined ? 0 : heights[nodes[n].left!];
      const right = nodes[n].right === undefined ? 0 : heights[nodes[n].right!];
      if (Math.abs(left - right) > 1) return false;
      heights[n] = 1 + Math.max(left, right);
    }
    let cursor: number | undefined = nodes.length ? 0 : undefined;
    while (cursor !== undefined || stack.length) {
      while (cursor !== undefined) { stack.push(cursor); cursor = nodes[cursor].left; }
      const n = stack.pop()!; inorder.push(nodes[n].value); cursor = nodes[n].right;
    }
    return equal(inorder, input[0]);
  }
  if (problem.signature.cmp === "unordered" || [15, 17, 22, 39, 46, 49, 51, 78, 90, 131].includes(problem.id)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    const bothLevels = [15, 39, 49, 78, 90].includes(problem.id);
    const normalize = (v: unknown[]) => sorted(v.map((x) => bothLevels && Array.isArray(x) ? sorted(x) : x));
    return equal(normalize(expected), normalize(actual), floating);
  }
  // Never treat "length" as a sufficient correctness check for arbitrary values.
  return equal(expected, actual, floating);
}
