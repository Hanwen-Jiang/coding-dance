// Data and I/O integration regression. No browser is required.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), cp = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { legacyAcmTemplate, previousAcmTemplate, starterHash } = require("./templates.cjs");
const root = path.resolve(__dirname, "../..");
const dir = path.join(root, "site/public/practice");

async function main() {
  const { encodeAcmInput, decodeAcmInput, encodeAcmOutput, parseAcmOutput } = await import(pathToFileURL(path.join(root, "site/lib/practice/acm.ts")).href);
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}\.json$/.test(f));
  assert.equal(files.length, 100);
  const expectedIds = fs.readdirSync(path.join(root, "tools/illustrations/specs")).filter((f) => /^\d+\.js$/.test(f)).map((f) => Number(f.split(".")[0])).sort((a, b) => a - b);
  const problems = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  const official = JSON.parse(cp.execFileSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"), [path.join(__dirname, "official-examples.py")], { encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" }, windowsHide: true }));
  assert.deepEqual(problems.map((p) => p.id).sort((a, b) => a - b), expectedIds);
  const pythonJobs = [];
  let count = 0, exampleCount = 0;
  for (const p of problems) {
    assert(p.acm.description.length > 20, `${p.id}: an authored statement is required`);
    assert(!p.acm.description.includes("实现函数"));
    assert(p.acm.input && p.acm.output);
    assert(p.cases.length >= 3, `${p.id}: examples and a boundary case are required`);
    assert(p.cases.some((c) => c.label.includes("边界")), `${p.id}: boundary provenance is required`);
    assert.equal(p.examples.length, official[p.id].length);
    assert.equal(p.acm.examples.length, p.examples.length);
    for (const lang of ["python", "javascript", "typescript"]) {
      assert(p.starters.leetcode[lang].includes("请完成"), `${p.id}: blank LeetCode starter required`);
      const blank = p.starters.acm[lang];
      assert.equal(blank, "", `${p.id}: ACM starter must be exactly empty, with no whitespace, imports or comments`);
      assert(!/solve/.test(p.acm.notes.join(" ")), `${p.id}: ACM notes must not describe hidden solve adapters`);
      const old = legacyAcmTemplate(p.signature, p.parameterNames, lang);
      assert.equal(p.legacyAcmStarterHashes[lang], starterHash(old));
      assert.notEqual(p.legacyAcmStarterHashes[lang], starterHash(old + "\n# my code"), `${p.id}: edited drafts must not match migration`);
      const previous = previousAcmTemplate(p.signature, p.parameterNames, lang);
      assert.deepEqual(p.previousAcmStarterHashes[lang], [starterHash(previous)]);
      const hashes = [p.legacyAcmStarterHashes[lang], ...p.previousAcmStarterHashes[lang]];
      assert(hashes.includes(starterHash(old)) && hashes.includes(starterHash(previous)));
      for (const code of [old, previous]) for (const edited of [code + " ", code + "\n# my code", code.replace("\n", "\n ")]) {
        assert(!hashes.includes(starterHash(edited)), `${p.id}: user edits must not migrate`);
      }
      assert(!hashes.includes(starterHash("")), `${p.id}: blank drafts must not be backed up repeatedly`);
      if (lang === "javascript") {
        let stdout = "";
        vm.runInNewContext(blank, { require: () => ({ readFileSync: () => "" }), console: { log: (s) => { stdout += s; } } });
        assert.equal(stdout, "");
      }
    }
    for (const [index, c] of p.cases.entries()) {
      assert.equal(encodeAcmInput(c.input, p.signature), c.stdin);
      assert.equal(encodeAcmOutput(c.expected, p.signature), c.stdout);
      assert.deepEqual(decodeAcmInput(c.stdin, p.signature), c.input);
      assert.deepEqual(parseAcmOutput(c.stdout, p.signature), c.expected);
      // Replace only the blank solve body with a fixture assertion and result.
      // This verifies that the actual user-facing parser reads every parameter correctly,
      // and that its actual stdout writer emits values the shared judge can parse.
      const js = legacyAcmTemplate(p.signature, p.parameterNames, "javascript").replace('throw new Error("请完成解法");', `if (JSON.stringify(Array.from(arguments)) !== ${JSON.stringify(JSON.stringify(c.input))}) throw new Error("Template input mismatch"); return ${JSON.stringify(c.expected)};`);
      let stdout = "";
      vm.runInNewContext(js, {
        require: (name) => { assert.equal(name, "fs"); return { readFileSync: () => c.stdin }; },
        console: { log: (...args) => { stdout += args.join(" ") + "\n"; } },
      }, { timeout: 1000, filename: `${p.id}-acm-${index}.js` });
      assert.deepEqual(parseAcmOutput(stdout, p.signature), c.expected, `${p.id}: JavaScript template output mismatch`);
      const argumentNames = p.signature.cls ? ["operations", "arguments"] : p.parameterNames;
      const py = legacyAcmTemplate(p.signature, p.parameterNames, "python").replace('raise NotImplementedError("请完成解法")', `assert [${argumentNames.join(", ")}] == __expected_input, "Template input mismatch"\n    return __expected`);
      pythonJobs.push({ id: p.id, index, source: py, input: c.stdin, expectedInput: c.input, expected: c.expected, signature: p.signature });
      count++;
    }
    for (const [index, example] of p.examples.entries()) {
      const source = official[p.id][index];
      assert.deepEqual(example.source, { path: source.path, index: source.index, input: source.inputText, output: source.outputText });
      const expectedInput = [141, 142].includes(p.id) ? [[source.fields.head, source.fields.pos]] : p.id === 160 ? [source.fields.listA, [source.fields.intersectVal === 0 ? source.fields.listB : source.fields.listB.slice(0, source.fields.skipB), source.fields.intersectVal === 0 ? -1 : source.fields.skipA]] : source.values;
      assert.deepEqual(example.input, expectedInput, `${p.id}: official example input mapping mismatch`);
      if (source.hasOutputValue) assert.deepEqual(example.expected, source.outputValue, `${p.id}: official output must preserve statement values`);
      assert(p.cases.some((c) => JSON.stringify(c.input) === JSON.stringify(example.input) && JSON.stringify(c.expected) === JSON.stringify(example.expected)));
      assert.equal(p.acm.examples[index].input, example.stdin);
      assert.equal(p.acm.examples[index].output, example.stdout);
      exampleCount++;
    }
  }
  const script = `import sys, json, io\njobs=json.load(sys.stdin)\nresults=[]\nfor job in jobs:\n    stdin, stdout=sys.stdin, sys.stdout\n    capture=io.StringIO()\n    try:\n        sys.stdin=io.StringIO(job["input"])\n        sys.stdout=capture\n        exec(compile(job["source"], "template.py", "exec"), {"__expected_input":job["expectedInput"],"__expected":job["expected"]})\n        results.append({"stdout":capture.getvalue()})\n    except Exception as e:\n        results.append({"error":repr(e), "id":job["id"], "case":job["index"]})\n    finally:\n        sys.stdin,sys.stdout=stdin,stdout\njson.dump(results,sys.stdout)\n`;
  const proc = cp.spawnSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"), ["-c", script], {
    input: JSON.stringify(pythonJobs), encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" }, timeout: 60000, maxBuffer: 64 << 20, windowsHide: true,
  });
  assert.equal(proc.status, 0, proc.stderr || proc.error?.message);
  const pythonResults = JSON.parse(proc.stdout);
  assert.equal(pythonResults.length, pythonJobs.length);
  pythonResults.forEach((r, i) => {
    assert(!r.error, JSON.stringify(r));
    const job = pythonJobs[i];
    assert.deepEqual(parseAcmOutput(r.stdout, job.signature), job.expected, `${job.id}: Python template output mismatch`);
  });
  assert.deepEqual(decodeAcmInput("\n", { fn: "f", params: ["string"], ret: "string" }), [""]);
  assert.equal(parseAcmOutput("\n", { fn: "f", params: [], ret: "string" }), "");
  assert.throws(() => decodeAcmInput("2\n1\n", { fn: "f", params: ["int[]"], ret: "int" }));
  assert.throws(() => parseAcmOutput("1\n2\nextra\n", { fn: "f", params: [], ret: "int[]" }));
  assert.throws(() => parseAcmOutput("not-a-number\n", { fn: "f", params: [], ret: "int" }));
  const find = (id) => problems.find((p) => p.id === id);
  assert.deepEqual(find(15).examples.map((c) => c.input), [[[-1, 0, 1, 2, -1, -4]], [[0, 1, 1]], [[0, 0, 0]]]);
  assert.deepEqual(find(1).examples.map((c) => c.input), [[[2, 7, 11, 15], 9], [[3, 2, 4], 6], [[3, 3], 6]]);
  assert.equal(exampleCount, 248);
  console.log(`Practice data verified: 100 problems, ${exampleCount} official examples with exact source mapping, ${count} cases, 300 exactly empty ACM starters, two generations of migration hashes, ${count} JavaScript and ${count} Python codec executions.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
