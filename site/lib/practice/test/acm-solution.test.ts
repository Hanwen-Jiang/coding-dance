import assert from "node:assert/strict";
import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAcmOutput } from "../acm.ts";
import { buildAcmSolution } from "../acm-solution.ts";
import { comparePracticeOutput } from "../compare.ts";
import type { PracticeProblem } from "../types.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const ILL_DIR = path.join(ROOT, "tools/illustrations/data");
const PRAC_DIR = path.join(ROOT, "tools/practice/data");

// 覆盖所有 100 题涉及的签名类型：数组、链表、环形/相交/随机链表、二叉树、TreeRef/TreeVal、char[][]、List<List<string>>、原地 void、设计类
const SAMPLE_IDS = [1, 2, 23, 31, 49, 104, 114, 138, 142, 146, 155, 160, 200, 208, 236, 295];
const OFFICIAL_LANGS = ["python", "javascript", "typescript", "java", "cpp", "go"];

function loadPair(id: number) {
  const pad = String(id).padStart(4, "0");
  const spec = JSON.parse(fs.readFileSync(path.join(ILL_DIR, `${pad}.json`), "utf8"));
  const practice = JSON.parse(fs.readFileSync(path.join(PRAC_DIR, `${pad}.json`), "utf8")) as PracticeProblem;
  return { spec, practice };
}

let n = 0;
function test(name: string, fn: () => void) {
  fn();
  n++;
  console.log(`ok ${n} - ${name}`);
}

test("为 6 种官方语言生成非空 ACM 题解并附带 I/O 提示", () => {
  for (const id of SAMPLE_IDS) {
    const { spec, practice } = loadPair(id);
    const entry = spec.codes[0];
    for (const lang of OFFICIAL_LANGS) {
      const src = lang === "python" ? entry.code : entry.langs?.[lang]?.code;
      if (!src) continue;
      const res = buildAcmSolution(src, lang, practice.signature, practice.parameterNames);
      assert.ok(res && res.code.length > 80, `#${id} ${lang} generated empty code`);
      assert.ok(res.tips.length >= 1, `#${id} ${lang} should include tips`);
    }
  }
});

test("Python 生成的 ACM 题解对覆盖全类型的代表题目实测 AC", () => {
  const pyBin = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  for (const id of SAMPLE_IDS) {
    const { spec, practice } = loadPair(id);
    const res = buildAcmSolution(spec.codes[0].code, "python", practice.signature, practice.parameterNames);
    assert.ok(res, `#${id} python missing`);
    for (const c of practice.cases.slice(0, 3)) {
      const proc: SpawnSyncReturns<string> = spawnSync(pyBin, ["-c", res.code], {
        input: c.stdin,
        encoding: "utf8",
        timeout: 10_000,
      });
      assert.equal(proc.status, 0, `#${id} python stderr: ${proc.stderr}`);
      const actual = parseAcmOutput(proc.stdout, practice.signature);
      assert.ok(
        comparePracticeOutput({ id: practice.id, signature: practice.signature }, c, actual),
        `#${id} (${c.label}) mismatch: got ${JSON.stringify(actual)}, expected ${JSON.stringify(c.expected)}\nstdout:\n${proc.stdout}`,
      );
    }
  }
});

test("JavaScript 生成的 ACM 题解对覆盖全类型的代表题目实测 AC", () => {
  for (const id of SAMPLE_IDS) {
    const { spec, practice } = loadPair(id);
    const jsCode = spec.codes[0].langs?.javascript?.code;
    assert.ok(jsCode, `#${id} js missing`);
    const res = buildAcmSolution(jsCode, "javascript", practice.signature, practice.parameterNames);
    assert.ok(res, `#${id} js acm missing`);
    for (const c of practice.cases.slice(0, 3)) {
      const proc: SpawnSyncReturns<string> = spawnSync(process.execPath, ["-e", res.code], {
        input: c.stdin,
        encoding: "utf8",
        timeout: 10_000,
      });
      assert.equal(proc.status, 0, `#${id} js stderr: ${proc.stderr}`);
      const actual = parseAcmOutput(proc.stdout, practice.signature);
      assert.ok(
        comparePracticeOutput({ id: practice.id, signature: practice.signature }, c, actual),
        `#${id} (${c.label}) mismatch: got ${JSON.stringify(actual)}, expected ${JSON.stringify(c.expected)}\nstdout:\n${proc.stdout}`,
      );
    }
  }
});
