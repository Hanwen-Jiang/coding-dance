// 起始代码和判题程序对得上：C、C#、Kotlin、Swift、Rust、Ruby、PHP、Scala、Dart 的 100 道题起始代码（力扣原样），
// 每个空方法体补一句「还没写」（返回默认值或抛异常，见 languages.mjs 的 fillStarter），按力扣模式拼成程序编译，跑第一组用例。
// 编译不过就说明判题程序传的参数类型、调用的函数名和起始代码不一样。运行结果不管（方法体是空的）。
//   在镜像里跑（CI；所有工具链都在，按核数并发）：
//     docker run --rm -v "$PWD:/src" -w /src -e RUNNER_WORK=/tmp/work lc-runner:ci node tools/runner/test/starters.test.mjs [语言…] [题号…]
//   本机：只测装了工具链的语言
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalDriver } from "../lib/sandbox.mjs";
import { fillStarter } from "./languages.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const TOOLS = { c: ["gcc"], csharp: ["dotnet", ["--list-sdks"]], kotlin: ["java", ["-version"], "/opt/kotlinc/lib/kotlin-compiler.jar"], swift: ["swiftc"], rust: ["rustc"], ruby: ["ruby"], php: ["php"], scala: ["java", ["-version"], "/opt/scala/lib/scala-compiler.jar"], dart: ["dart"] };
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

const driver = new LocalDriver();
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
      const r = await driver.run(input, 180000);
      assert.ok(r.ok, "沙箱没有返回结果：" + r.error);
      assert.equal(r.json.ok, true, r.json.error);
      assert.equal(r.json.compileError, undefined, "编译不过：\n" + r.json.compileError);
      const x = r.json.results[0];
      // 判题程序自己出错（找不到函数、启动失败）也算没对上；空方法体抛「还没写」之类的不算
      assert.ok(!/没有找到|启动超时|判题程序|NoSuchMethod|undefined method|Call to undefined/.test(x.error || ""), "判题程序出错：" + x.error);
    } catch (e) {
      failed++;
      fails.push(`  ✗ ${String(p.id).padStart(4, "0")} ${p.name} · ${lang}\n      ${String(e.message || e).split("\n").slice(0, 8).join("\n      ")}`);
    }
  }
}));
console.log(fails.join("\n"));
console.log(`${failed ? "✗" : "✓"} 起始代码：${jobs.length - failed} / ${jobs.length} 组编译、运行正常（${langs.join("、")}；${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
if (failed) process.exit(1);
