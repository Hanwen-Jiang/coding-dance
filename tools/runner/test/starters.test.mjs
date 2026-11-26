// 起始代码和判题程序对得上：Python、JavaScript、TypeScript（网站上也能选云端运行）和 C、C#、Kotlin、Swift、Rust、Ruby、PHP、Scala、Dart
// 的 100 道题起始代码（力扣原样），每个空方法体补一句「还没写」（返回默认值或抛异常，Python 补 pass，见 languages.mjs 的 fillStarter），
// 按力扣模式拼成程序编译，跑第一组用例。
//   在镜像里跑（CI；所有工具链都在，按核数并发）：
//     docker run --rm -v "$PWD:/src:ro" -w /src -e RUNNER_WORK=/tmp/work lc-runner:ci node tools/runner/test/starters.test.mjs [语言…] [题号…]
//   本机：只测装了工具链的语言
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fillStarter } from "./languages.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "../../..");
const SANDBOX_JS = fs.existsSync("/opt/lc/tools/runner/sandbox/sandbox.js")
  ? "/opt/lc/tools/runner/sandbox/sandbox.js"
  : path.join(HERE, "../sandbox/sandbox.js");

function runSandboxDirect(input, timeoutMs = 180000) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "lc-starter-"));
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SANDBOX_JS], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, RUNNER_WORK: work },
    });
    const out = [];
    let err = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (b) => out.push(b));
    child.stderr.on("data", (b) => { err = (err + b).slice(-4000); });
    child.stdin.end(input);
    child.on("close", () => {
      clearTimeout(timer);
      fs.rmSync(work, { recursive: true, force: true });
      if (timedOut) return resolve({ ok: false, error: "超时" });
      try { resolve({ ok: true, json: JSON.parse(Buffer.concat(out).toString("utf8")) }); }
      catch { resolve({ ok: false, error: err || "沙箱未返回合法 JSON" }); }
    });
  });
}

const PY = (process.env.PYTHON || (process.platform === "win32" ? "python" : "python3")).split(" ");
const TOOLS = { python: [PY[0], [...PY.slice(1), "--version"]], javascript: [process.execPath], typescript: [process.execPath], c: ["gcc"], csharp: ["dotnet", ["--list-sdks"]], kotlin: ["java", ["-version"], "/opt/kotlinc/lib/kotlin-compiler.jar"], swift: ["swiftc"], rust: ["rustc"], ruby: ["ruby"], php: ["php"], scala: ["java", ["-version"], "/opt/scala/lib/scala-compiler.jar"], dart: ["dart"] };
const has = ([cmd, args = ["--version"], file]) => { const r = spawnSync(cmd, args, { stdio: "ignore" }); return !r.error && r.status === 0 && (!file || fs.existsSync(file)); };
const argv = process.argv.slice(2);
const pick = argv.filter((a) => TOOLS[a]), ids = argv.filter((a) => /^\d+$/.test(a)).map(Number);
const langs = (pick.length ? pick : Object.keys(TOOLS)).filter((l) => { const ok = has(TOOLS[l]); if (!ok) console.log(`- ${l}：本机没有它的工具链，跳过`); return ok; });

const files = fs.readdirSync(path.join(ROOT, "tools/practice/data")).filter((f) => /^\d{4}\.json$/.test(f)).sort();
const problems = files.map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "tools/practice/data", f), "utf8"))).filter((p) => !ids.length || ids.includes(p.id));
const jobs = [];
for (const lang of langs) for (const p of problems) {
  if (p.leetcodeUnavailable?.[lang]) continue;
  jobs.push({ lang, p, code: fillStarter(lang, p.starters.leetcode[lang]) });
}

const width = Math.max(1, Math.min(8, os.cpus().length));
let next = 0, failed = 0;
const fails = [];
const t0 = Date.now();
await Promise.all(Array.from({ length: width }, async () => {
  for (;;) {
    const i = next++;
    if (i >= jobs.length) return;
    const { lang, p, code } = jobs[i];
    try {
      const input = JSON.stringify({ lang, mode: "leetcode", code, sig: p.signature, cases: [{ input: p.cases[0].input }], limits: { caseMs: 10000, totalMs: 30000 } });
      const r = await runSandboxDirect(input, 180000);
      assert.ok(r.ok, "沙箱没有返回结果：" + r.error);
      assert.equal(r.json.ok, true, r.json.error);
      assert.equal(r.json.compileError, undefined, "编译不过：\n" + r.json.compileError);
      const x = r.json.results[0];
      assert.ok(!/没有找到|启动超时|判题程序|NoSuchMethod|undefined method|Call to undefined|'(?!NoneType)\w+' object has no attribute|is not a function/.test(x.error || ""), "判题程序出错：" + x.error);
    } catch (e) {
      failed++;
      fails.push(`  ✗ ${String(p.id).padStart(4, "0")} ${p.name} · ${lang}\n      ${String(e.message || e).split("\n").slice(0, 8).join("\n      ")}`);
    }
  }
}));
console.log(fails.join("\n"));
console.log(`${failed ? "✗" : "✓"} 起始代码：${jobs.length - failed} / ${jobs.length} 组编译、运行正常（${langs.join("、")}；${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
if (failed) process.exit(1);
