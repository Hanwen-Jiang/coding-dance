"use strict";
// 把用户代码拼成能运行的程序。
// 力扣模式：判题器（tools/illustrations/judge）的前置代码 + 用户代码 + 练习用的入口。入口按下标从 from 开始逐组运行，
// 每组前后往标准输出写分隔标记 \x01<令牌>:S:<k>\x02 和 \x01<令牌>:R:<k>:<结果 JSON>\x02，两个标记之间就是这一组的输出。
// 一组崩了或超时，沙箱从下一组重新启动程序（见 exec.js），所以每组互不影响。
// 用户代码在生成的文件里整体往下挪了 off 行；报错、调试记录里的行号都要减掉 off 才是编辑器里的行号。
const path = require("path");

const JUDGE = path.join(__dirname, "../../illustrations/judge");
const { normSig, flatSig, usesType } = require(path.join(JUDGE, "util"));
const L = {
  python: require(path.join(JUDGE, "langs/python")),
  java: require(path.join(JUDGE, "langs/java")),
  cpp: require(path.join(JUDGE, "langs/cpp")),
  go: require(path.join(JUDGE, "langs/go")),
  ...require(path.join(JUDGE, "langs/javascript")),
  c: require(path.join(JUDGE, "langs/c")),
  csharp: require(path.join(JUDGE, "langs/csharp")),
  kotlin: require(path.join(JUDGE, "langs/kotlin")),
  scala: require(path.join(JUDGE, "langs/scala")),
  swift: require(path.join(JUDGE, "langs/swift")),
  rust: require(path.join(JUDGE, "langs/rust")),
  dart: require(path.join(JUDGE, "langs/dart")),
  ...require(path.join(JUDGE, "langs/scripting")),
};
const { fnName, methodName } = require(path.join(JUDGE, "langs/names"));
/** 运行器支持的语言（/v1/status 报给网站）；后九种只在云端运行，没有官方题解 */
const LANG_IDS = ["python", "java", "cpp", "go", "javascript", "typescript", "c", "csharp", "kotlin", "swift", "rust", "ruby", "php", "scala", "dart"];

const lines = (s) => s.split("\n").length;
const newlines = (s) => s.split("\n").length - 1;
const clean = (code) => code.replace(/\r\n/g, "\n").replace(/\s+$/, "");

/** 练习数据里的签名（PracticeSignature）换成判题器的写法；Python 的方法名可能不一样（pythonFn / pythonMethods） */
function sigOf(raw, lang) {
  const s = { ...raw };
  if (lang === "python" && s.pythonFn) s.fn = s.pythonFn;
  return normSig(s);
}

// —— Python ——
function python(job, sig) {
  const P = L.python.parts, code = clean(job.code);
  const head = "__JUDGE_PRACTICE = True\n" + P.prelude + (usesType(sig, "RandomList") ? P.NODE : "") + "\n";
  const off = newlines(head), n = lines(code);
  const renames = JSON.stringify((job.sig && job.sig.pythonMethods) || {});
  const main = `
import os as __os, traceback as __tb
__sys.setrecursionlimit(200000)
__OFF, __N, __REN = ${off}, ${n}, ${renames}

def __pmark(s):
    __sys.stdout.flush()
    __os.write(1, ("\\x01" + __TOK + ":" + s + "\\x02").encode())

def __pwhere(e):
    hit = [f.lineno for f in __tb.extract_tb(e.__traceback__) if f.filename == __file__ and __OFF < f.lineno <= __OFF + __N]
    return "（第 %d 行）" % (hit[-1] - __OFF) if hit else ""

def __pcase(sig, case):
    __reset()
    if sig["kind"] == "design":
        ops, argv = case
        obj = globals()[sig["cls"]](*[__jin(t, v) for t, v in zip(sig["ctor"], argv[0])])
        out = [None]
        for name, a in zip(ops[1:], argv[1:]):
            m = sig["methods"][name]
            r = getattr(obj, __REN.get(name, name))(*[__jin(t, v) for t, v in zip(m["params"], a)])
            out.append(None if m["ret"] == "void" else __jout(m["ret"], r))
        return out
    return __jcase(sig, case)

def __pmain():
    global __TOK
    spec = __json.loads(open(__sys.argv[1], encoding="utf-8").read())
    start, __TOK = int(__sys.argv[2]), __sys.argv[3]
    for k in range(start, len(spec["cases"])):
        __pmark("S:%d" % k)
        try:
            res = __json.dumps(__pcase(spec["sig"], spec["cases"][k]), ensure_ascii=False)
        except RecursionError as e:
            res = __json.dumps({"__error": "RecursionError: 递归太深" + __pwhere(e)}, ensure_ascii=False)
        except Exception as e:
            res = __json.dumps({"__error": (type(e).__name__ + (": " + str(e) if str(e) else "")) + __pwhere(e)}, ensure_ascii=False)
        __pmark("R:%d:%s" % (k, res))

__pmain()
`;
  return {
    files: { "main.py": head + code + "\n" + P.runner + main, "solution.py": code + "\n", "spec.json": JSON.stringify({ sig: flatSig(sig), cases: job.cases.map((c) => c.input) }) },
    main: "main.py", user: "main.py", off, n, args: (from, tok) => ["main.py", "spec.json", String(from), tok],
  };
}

// —— JavaScript / TypeScript ——
function script(job, sig, ts) {
  const P = L[ts ? "typescript" : "javascript"].parts, code = clean(job.code), ext = ts ? "ts" : "js";
  const head = (ts ? 'import { readFileSync as __read, writeSync as __write } from "node:fs";\n' : 'const { readFileSync: __read, writeSync: __write } = require("fs");\n')
    + P.prelude + (usesType(sig, "RandomList") ? P.node : "") + "\n";
  const off = newlines(head), n = lines(code);
  const A = ts ? ": any" : "", N = ts ? ": number" : "";
  const target = sig.kind === "design" ? sig.cls : sig.fn;
  const main = `
;(function () {
  const { sig, cases } = JSON.parse(__read(process.argv[2], "utf8"));
  const from = Number(process.argv[3]), TOK = process.argv[4];
  const mark = (s${A}) => { __write(1, "\\x01" + TOK + ":" + s + "\\x02"); };
  const where = (e${A}) => {
    for (const m of String((e && e.stack) || "").matchAll(/main\\.${ext}:(\\d+):\\d+/g)) {
      const l = Number(m[1]) - ${off};
      if (l >= 1 && l <= ${n}) return "（第 " + l + " 行）";
    }
    return "";
  };
  const target${A} = typeof ${target} === "undefined" ? undefined : ${target};
  for (let k = from; k < cases.length; k++) {
    const c${A} = cases[k];
    let out${A};
    mark("S:" + k);
    __judge.reset();
    try {
      if (target === undefined) throw new Error("没有找到 ${target}，请保留模板里的名字");
      if (sig.kind === "design") {
        const [ops, argv] = c;
        const obj${A} = new target(...argv[0].map((v${A}, i${N}) => __judge.in(sig.ctor[i], v)));
        out = [null];
        for (let j = 1; j < ops.length; j++) {
          const m = sig.methods[ops[j]];
          const r = obj[ops[j]](...argv[j].map((v${A}, i${N}) => __judge.in(m.params[i], v)));
          out.push(m.ret === "void" ? null : __judge.out(m.ret, r));
        }
      } else {
        const args = c.map((v${A}, i${N}) => __judge.in(sig.params[i], v));
        const r = target(...args);
        out = sig.ret === "void" ? __judge.out(sig.params[sig.out], args[sig.out]) : __judge.out(sig.ret, r);
      }
    } catch (e${A}) {
      out = { __error: (e instanceof RangeError && /call stack/.test(String(e.message)) ? "RangeError: 递归太深（调用栈溢出）" : (e && e.name ? e.name + ": " + e.message : String(e))) + where(e) };
    }
    let json;
    try { json = JSON.stringify(out === undefined ? null : out); } catch (e${A}) { json = JSON.stringify({ __error: "返回值没法转成 JSON：" + String(e) }); }
    mark("R:" + k + ":" + json);
  }
})();
${ts ? "export {};\n" : ""}`;
  const file = `main.${ext}`;
  return {
    files: { [file]: head + code + "\n" + main, "spec.json": JSON.stringify({ sig: flatSig(sig), cases: job.cases.map((c) => c.input) }) },
    main: file, user: file, off, n, args: (from, tok) => [file, "spec.json", String(from), tok],
  };
}

// —— Java ——
function java(job, sig) {
  const P = L.java.parts, code = clean(job.code);
  // 用户写的 import 挪到文件开头，原位置留空行，行号不变；public class 去掉 public（和入口类放在同一个文件里）
  const imports = [], body = [];
  for (const line of code.split("\n")) {
    if (/^\s*import\s+(static\s+)?[\w.]+(\.\*)?\s*;\s*$/.test(line)) { imports.push(line.trim()); body.push(""); }
    else if (/^\s*package\s+[\w.]+\s*;\s*$/.test(line)) body.push("");
    else body.push(line.replace(/^public\s+((?:final\s+|abstract\s+)?(?:class|interface|enum|record)\s)/, "$1"));
  }
  const head = ["import java.util.*;", "import java.util.function.*;", "import java.util.stream.*;", "import java.math.*;", ...imports].join("\n") + "\n" + P.prelude + "\n" + (usesType(sig, "RandomList") ? P.NODE : "") + "\n";
  const off = newlines(head), n = body.length;
  const emit = (json) => `emit(${json});`;
  const cases = job.cases.map((c, k) => `    static void c${k}() {\n        H.reset();\n        ${P.caseBody(sig, c.input, emit).join("\n        ")}\n    }`);
  const main = `
public class JudgeMain {
    static String tok;
    static int cur;
    static final int OFF = ${off}, N = ${n};

    static void mark(String s) {
        System.out.flush();
        System.out.print("\\u0001" + tok + ":" + s + "\\u0002");
        System.out.flush();
    }

    static void emit(String json) { mark("R:" + cur + ":" + json); }

    static String where(Throwable e) {
        for (StackTraceElement f : e.getStackTrace())
            if ("JudgeMain.java".equals(f.getFileName()) && f.getLineNumber() > OFF && f.getLineNumber() <= OFF + N) return "（第 " + (f.getLineNumber() - OFF) + " 行）";
        return "";
    }

${cases.join("\n\n")}

    public static void main(String[] args) {
        int from = Integer.parseInt(args[0]);
        tok = args[1];
        for (int k = from; k < ${job.cases.length}; k++) {
            cur = k;
            mark("S:" + k);
            try {
                switch (k) {
${job.cases.map((_, k) => `                    case ${k}: c${k}(); break;`).join("\n")}
                }
            } catch (StackOverflowError e) {
                emit("{\\"__error\\":" + H.json("java.lang.StackOverflowError：递归太深" + where(e)) + "}");
            } catch (Throwable e) {
                emit("{\\"__error\\":" + H.json(e.toString() + where(e)) + "}");
            }
        }
        System.out.flush();
    }
}
`;
  return { files: { "JudgeMain.java": head + body.join("\n") + "\n" + main }, main: "JudgeMain", user: "JudgeMain.java", off, n, args: (from, tok) => [String(from), tok] };
}

// —— C++ ——
function cpp(job, sig) {
  const P = L.cpp.parts, code = clean(job.code);
  const head = '#include "prelude.h"\n#include <unistd.h>\n#include <cxxabi.h>\n' + (usesType(sig, "RandomList") ? P.NODE : "") + "\n";
  const off = newlines(head), n = lines(code);
  const emit = (json) => `jEmit(${json});`;
  const cases = job.cases.map((c, k) => `static void jCase${k}() {\n    jReset();\n    ${P.caseBody(sig, c.input, emit).join("\n    ")}\n}`);
  const main = `
static string jTok;
static int jCur;

static void jMark(const string& s) {
    cout.flush();
    fflush(stdout);
    string m = "\\x01" + jTok + ":" + s + "\\x02";
    size_t w = 0;
    while (w < m.size()) {
        ssize_t r = ::write(1, m.data() + w, m.size() - w);
        if (r <= 0) break;
        w += (size_t)r;
    }
}

static void jEmit(const string& json) { jMark("R:" + to_string(jCur) + ":" + json); }

static string jTypeName(const std::type_info& t) {
    int st = 0;
    char* d = abi::__cxa_demangle(t.name(), nullptr, nullptr, &st);
    string s = st == 0 && d ? d : t.name();
    free(d);
    return s;
}

${cases.join("\n\n")}

int main(int argc, char** argv) {
    int from = argc > 1 ? atoi(argv[1]) : 0;
    jTok = argc > 2 ? argv[2] : "";
    if (argc > 3 && string(argv[3]) == "debug") { setvbuf(stdout, nullptr, _IONBF, 0); cout.setf(ios::unitbuf); }
    for (int k = from; k < ${job.cases.length}; k++) {
        jCur = k;
        jMark("S:" + to_string(k));
        try {
            switch (k) {
${job.cases.map((_, k) => `                case ${k}: jCase${k}(); break;`).join("\n")}
            }
        } catch (const exception& e) {
            jEmit("{\\"__error\\":" + js(jTypeName(typeid(e)) + ": " + e.what()) + "}");
        } catch (...) {
            jEmit("{\\"__error\\":\\"抛出了异常\\"}");
        }
    }
    return 0;
}
`;
  return { files: { "main.cpp": head + code + "\n" + main }, user: "main.cpp", off, n, args: (from, tok) => [String(from), tok] };
}

// —— Go ——
function go(job, sig) {
  const P = L.go.parts, code = clean(job.code);
  const withImp = P.withImports(code);
  const head = "package main\n\n" + withImp.slice(0, withImp.length - code.length);
  const off = newlines(head), n = lines(code);
  const cases = job.cases.map((c) => `\t\tfunc() any {\n\t\t\tjudgeReset()\n\t\t\t${P.caseBody(sig, c.input).join("\n").replace(/\n/g, "\n\t\t\t")}\n\t\t},`);
  const main = `package main

import (
	jjson "encoding/json"
	jfmt "fmt"
	jos "os"
	jdebug "runtime/debug"
	jstrconv "strconv"
	jstrings "strings"
)

var judgeTok string
var judgeCur int

func judgeMark(s string) { jos.Stdout.WriteString("\\x01" + judgeTok + ":" + s + "\\x02") }

func judgeWhere(st string) string {
	for _, line := range jstrings.Split(st, "\\n") {
		i := jstrings.Index(line, "sol.go:")
		if i < 0 {
			continue
		}
		rest, j := line[i+7:], 0
		for j < len(rest) && rest[j] >= '0' && rest[j] <= '9' {
			j++
		}
		n, _ := jstrconv.Atoi(rest[:j])
		if n > ${off} && n <= ${off + n} {
			return jfmt.Sprintf("（第 %d 行）", n-${off})
		}
	}
	return ""
}

func judgeCase(f func() any) {
	defer func() {
		if r := recover(); r != nil {
			b, _ := jjson.Marshal(map[string]string{"__error": jfmt.Sprint(r) + judgeWhere(string(jdebug.Stack()))})
			judgeMark("R:" + jstrconv.Itoa(judgeCur) + ":" + string(b))
		}
	}()
	b, err := jjson.Marshal(f())
	if err != nil {
		b, _ = jjson.Marshal(map[string]string{"__error": err.Error()})
	}
	judgeMark("R:" + jstrconv.Itoa(judgeCur) + ":" + string(b))
}

func main() {
	from, _ := jstrconv.Atoi(jos.Args[1])
	judgeTok = jos.Args[2]
	cases := []func() any{
${cases.join("\n")}
	}
	for k := from; k < len(cases); k++ {
		judgeCur = k
		judgeMark("S:" + jstrconv.Itoa(k))
		judgeCase(cases[k])
	}
}
`;
  const files = { "sol.go": head + code + "\n", "main.go": main, "prelude.go": P.prelude };
  if (usesType(sig, "RandomList")) files["random.go"] = P.NODE;
  return { files, user: "sol.go", off, n, args: (from, tok) => [String(from), tok] };
}

// —— C ——
function cLang(job, sig) {
  const P = L.c.parts, code = clean(job.code), random = usesType(sig, "RandomList");
  const head = P.head + (random ? P.NODE_HEAD : "") + "\n";
  const off = newlines(head), n = lines(code);
  const cases = job.cases.map((c, k) => `static void jCase${k}(void) {\n    jReset();\n    ${P.caseBody(sig, c.input).join("\n    ")}\n}`);
  const main = `
${P.prelude}${random ? P.NODE : ""}
${cases.join("\n\n")}

int main(int argc, char **argv) {
    int from = argc > 1 ? atoi(argv[1]) : 0;
    jTok = argc > 2 ? argv[2] : "";
    for (int k = from; k < ${job.cases.length}; k++) {
        char s[32];
        jCur = k;
        snprintf(s, sizeof s, "S:%d", k);
        jMark(s);
        switch (k) {
${job.cases.map((_, k) => `            case ${k}: jCase${k}(); break;`).join("\n")}
        }
    }
    fflush(stdout);
    return 0;
}
`;
  return { files: { "main.c": head + code + "\n" + main }, user: "main.c", off, n, args: (from, tok) => [String(from), tok] };
}

// —— C# ——（用户代码单独一个文件 sol.cs，行号不用挪）
function csharp(job, sig) {
  const P = L.csharp.parts, code = clean(job.code), n = lines(code);
  const emit = (json) => `Emit(${json});`;
  const cases = job.cases.map((c, k) => `    static void C${k}() {\n        JH.Reset();\n        ${P.caseBody(sig, c.input, emit).join("\n        ")}\n    }`);
  const main = `${P.prelude}${usesType(sig, "RandomList") ? P.NODE : ""}
public static class JudgeMain {
    static string tok = "";
    static int cur;
    const int N = ${n};

    static void Mark(string s) {
        Console.Out.Flush();
        Console.Out.Write("\\u0001" + tok + ":" + s + "\\u0002");
        Console.Out.Flush();
    }

    static void Emit(string json) { Mark("R:" + cur + ":" + json); }

    static string Where(Exception e) {
        var frames = new System.Diagnostics.StackTrace(e, true).GetFrames();
        foreach (var f in frames) {
            var file = f.GetFileName();
            int l = f.GetFileLineNumber();
            if (file != null && file.EndsWith("sol.cs") && l >= 1 && l <= N) return "（第 " + l + " 行）";
        }
        return "";
    }

${cases.join("\n\n")}

    static void Run(int from) {
        for (int k = from; k < ${job.cases.length}; k++) {
            cur = k;
            Mark("S:" + k);
            try {
                switch (k) {
${job.cases.map((_, k) => `                    case ${k}: C${k}(); break;`).join("\n")}
                }
            } catch (Exception e) {
                Emit("{\\"__error\\":" + JH.Q(e.GetType().Name + ": " + e.Message + Where(e)) + "}");
            }
        }
    }

    public static void Main(string[] args) {
        Console.OutputEncoding = new UTF8Encoding(false);
        int from = int.Parse(args[0]);
        tok = args[1];
        // 递归深的题解要大一点的栈
        var t = new System.Threading.Thread(() => Run(from), 256 << 20);
        t.Start();
        t.Join();
        Console.Out.Flush();
    }
}
`;
  return { files: { "globals.cs": P.GLOBALS, "sol.cs": code + "\n", "judge.cs": main }, main: "JudgeMain", user: "sol.cs", harness: ["judge.cs", "globals.cs"], off: 0, n, args: (from, tok) => [String(from), tok] };
}

/** package 那一行换成空行（文件都在同一个默认包里），行号不变 */
const noPackage = (code) => code.split("\n").map((l) => (/^\s*package\s+[\w.]+\s*;?\s*$/.test(l) ? "" : l)).join("\n");

// —— Kotlin ——（用户代码单独一个文件 sol.kt）
function kotlin(job, sig) {
  const P = L.kotlin.parts, code = noPackage(clean(job.code)), n = lines(code);
  const emit = (json) => `emit(${json})`;
  const cases = job.cases.map((c, k) => `    fun c${k}() {\n        JH.reset()\n        ${P.caseBody(sig, c.input, emit).join("\n        ")}\n    }`);
  const main = `object JudgeMain {
    var tok = ""
    var cur = 0
    const val N = ${n}

    fun mark(s: String) {
        System.out.flush()
        System.out.print("\\u0001" + tok + ":" + s + "\\u0002")
        System.out.flush()
    }

    fun emit(json: String) = mark("R:" + cur + ":" + json)

    fun where(e: Throwable): String {
        for (f in e.stackTrace) if (f.fileName == "sol.kt" && f.lineNumber in 1..N) return "（第 " + f.lineNumber + " 行）"
        return ""
    }

${cases.join("\n\n")}

    @JvmStatic
    fun main(args: Array<String>) {
        val from = args[0].toInt()
        tok = args[1]
        for (k in from until ${job.cases.length}) {
            cur = k
            mark("S:" + k)
            try {
                when (k) {
${job.cases.map((_, k) => `                    ${k} -> c${k}()`).join("\n")}
                }
            } catch (e: StackOverflowError) {
                emit("{\\"__error\\":" + JH.q("java.lang.StackOverflowError：递归太深" + where(e)) + "}")
            } catch (e: Throwable) {
                emit("{\\"__error\\":" + JH.q(e.toString() + where(e)) + "}")
            }
        }
        System.out.flush()
    }
}
`;
  return { files: { "sol.kt": code + "\n", "prelude.kt": P.prelude + (usesType(sig, "RandomList") ? P.NODE : ""), "main.kt": main }, main: "JudgeMain", user: "sol.kt", harness: ["prelude.kt", "main.kt"], off: 0, n, args: (from, tok) => [String(from), tok] };
}

// —— Scala ——（用户代码单独一个文件 sol.scala）
function scala(job, sig) {
  const P = L.scala.parts, code = noPackage(clean(job.code)), n = lines(code);
  const emit = (json) => `emit(${json})`;
  const cases = job.cases.map((c, k) => `  def c${k}(): Unit = {\n    JH.reset()\n    ${P.caseBody(sig, c.input, emit).join("\n    ")}\n  }`);
  const main = `object JudgeMain {
  var tok = ""
  var cur = 0
  val N = ${n}

  def mark(s: String): Unit = {
    Console.out.flush()
    System.out.flush()
    System.out.print("\\u0001" + tok + ":" + s + "\\u0002")
    System.out.flush()
  }

  def emit(json: String): Unit = mark("R:" + cur + ":" + json)

  def where(e: Throwable): String = {
    for (f <- e.getStackTrace) if (f.getFileName == "sol.scala" && f.getLineNumber >= 1 && f.getLineNumber <= N) return "（第 " + f.getLineNumber + " 行）"
    ""
  }

${cases.join("\n\n")}

  def main(args: Array[String]): Unit = {
    val from = args(0).toInt
    tok = args(1)
    for (k <- from until ${job.cases.length}) {
      cur = k
      mark("S:" + k)
      try {
        k match {
${job.cases.map((_, k) => `          case ${k} => c${k}()`).join("\n")}
          case _ =>
        }
      } catch {
        case e: StackOverflowError => emit("{\\"__error\\":" + JH.q("java.lang.StackOverflowError：递归太深" + where(e)) + "}")
        case e: Throwable => emit("{\\"__error\\":" + JH.q(e.toString + where(e)) + "}")
      }
    }
    Console.out.flush()
    System.out.flush()
  }
}
`;
  return { files: { "sol.scala": code + "\n", "prelude.scala": P.prelude + (usesType(sig, "RandomList") ? P.NODE : ""), "main.scala": main }, main: "JudgeMain", user: "sol.scala", harness: ["prelude.scala", "main.scala"], off: 0, n, args: (from, tok) => [String(from), tok] };
}

// —— Swift ——（用户代码单独一个文件 sol.swift，前面加一行 import Foundation）
function swift(job, sig) {
  const P = L.swift.parts, code = clean(job.code);
  const head = "import Foundation\n", off = newlines(head), n = lines(code);
  const cases = job.cases.map((c, k) => `func jCase${k}() -> String {\n    jReset()\n    ${P.caseBody(sig, c.input).join("\n    ")}\n}`);
  const main = `#if canImport(Glibc)
import Glibc
#endif

var jTok = ""
var jCur = 0

func jMark(_ s: String) {
    fflush(stdout)
    let bytes = Array(("\\u{01}" + jTok + ":" + s + "\\u{02}").utf8)
    bytes.withUnsafeBytes { p in
        var o = 0
        while o < p.count {
            let w = write(1, p.baseAddress! + o, p.count - o)
            if w <= 0 { break }
            o += w
        }
    }
}

${cases.join("\n\n")}

let jCases: [() -> String] = [${job.cases.map((_, k) => `jCase${k}`).join(", ")}]
let jArgs = CommandLine.arguments
let jFrom = Int(jArgs[1]) ?? 0
jTok = jArgs[2]
for k in jFrom..<jCases.count {
    jCur = k
    jMark("S:\\(k)")
    let r = jCases[k]()
    jMark("R:\\(k):" + r)
}
fflush(stdout)
`;
  return { files: { "sol.swift": head + code + "\n", "prelude.swift": P.prelude + (usesType(sig, "RandomList") ? P.NODE : ""), "main.swift": main }, user: "sol.swift", harness: ["prelude.swift", "main.swift"], off, n, args: (from, tok) => [String(from), tok] };
}

// —— Rust ——（用户代码在最前面，行号不用挪；判题部分接在后面）
function rust(job, sig) {
  const P = L.rust.parts, code = clean(job.code), n = lines(code);
  const bad = P.UNSUPPORTED.find((t) => usesType(sig, t));
  if (bad) throw new Error("力扣没有这道题的 Rust 版本（链表要成环或者共用节点，Option<Box<ListNode>> 表示不了），可以切到 ACM 模式用 Rust 写");
  const cases = job.cases.map((c, k) => `#[allow(unused_mut, unused_variables)]\nfn __jc${k}() -> String {\n    __j::reset();\n    ${P.caseBody(sig, c.input).join("\n    ")}\n}`);
  const main = `
${P.prelude}
${cases.join("\n\n")}

fn __jmark(tok: &str, s: &str) {
    use std::io::Write;
    let out = std::io::stdout();
    let mut o = out.lock();
    let _ = write!(o, "\\x01{}:{}\\x02", tok, s);
    let _ = o.flush();
}

fn __jrun(from: usize, tok: String) {
    let cases: Vec<fn() -> String> = vec![${job.cases.map((_, k) => `__jc${k}`).join(", ")}];
    for k in from..cases.len() {
        __jmark(&tok, &format!("S:{}", k));
        let f = cases[k];
        let json = match std::panic::catch_unwind(f) {
            Ok(s) => s,
            Err(_) => format!("{{\\"__error\\":{}}}", __j::q(&__j::PANIC.with(|p| p.borrow().clone()))),
        };
        __jmark(&tok, &format!("R:{}:{}", k, json));
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let from: usize = args[1].parse().unwrap_or(0);
    let tok = args[2].clone();
    std::panic::set_hook(Box::new(|info| {
        let p = info.payload();
        let msg = if let Some(s) = p.downcast_ref::<&str>() { s.to_string() } else if let Some(s) = p.downcast_ref::<String>() { s.clone() } else { String::from("panic") };
        let at = match info.location() { Some(l) if l.file().ends_with("main.rs") && l.line() >= 1 && l.line() <= ${n} => format!("（第 {} 行）", l.line()), _ => String::new() };
        __j::PANIC.with(|x| *x.borrow_mut() = format!("panicked: {}{}", msg, at));
    }));
    // 递归深的题解要大一点的栈
    let h = std::thread::Builder::new().stack_size(256 << 20).spawn(move || __jrun(from, tok)).unwrap();
    let _ = h.join();
}
`;
  return { files: { "main.rs": code + "\n" + main }, user: "main.rs", off: 0, n, args: (from, tok) => [String(from), tok] };
}

/** 函数名、方法名在这门语言里叫什么（Ruby、PHP 的运行时用） */
function entryNames(lang, sig) {
  if (sig.kind === "design") return Object.fromEntries(Object.keys(sig.methods).map((m) => [m, methodName(lang, sig.cls, m)]));
  return { __fn: fnName(lang, sig.fn) };
}

// —— Ruby ——（判题部分在前面，用户代码挪了 off 行）
function ruby(job, sig) {
  const code = clean(job.code);
  const head = L.ruby.parts.prelude + "\n";
  const off = newlines(head), n = lines(code);
  const main = `
$__j_tok = ARGV[2]
def __j_mark(s)
  $stdout.flush
  $stdout.write("\\x01" + $__j_tok + ":" + s + "\\x02")
  $stdout.flush
end

def __j_where(e)
  (e.backtrace_locations || []).each do |l|
    return "（第 #{l.lineno - ${off}} 行）" if l.path.to_s.end_with?('main.rb') && l.lineno > ${off} && l.lineno <= ${off + n}
  end
  ''
end

__j_spec = JSON.parse(File.read(ARGV[0], encoding: 'UTF-8'))
__j_names = JSON.parse(${JSON.stringify(JSON.stringify(entryNames("ruby", sig)))})
__j_from = ARGV[1].to_i
# 递归深的题解要大一点的栈（RUBY_THREAD_VM_STACK_SIZE 由运行器设）
Thread.new do
  (__j_from...__j_spec['cases'].length).each do |k|
    __j_mark("S:#{k}")
    begin
      res = JSON.generate(JudgeH.run_case(__j_spec['sig'], __j_spec['cases'][k], __j_names))
    rescue SystemStackError => e
      res = JSON.generate({ '__error' => 'SystemStackError: 递归太深' + __j_where(e) })
    rescue Exception => e
      res = JSON.generate({ '__error' => "#{e.class}: #{e.message}" + __j_where(e) })
    end
    __j_mark("R:#{k}:#{res}")
  end
end.join
`;
  return {
    files: { "main.rb": head + code + "\n" + main, "spec.json": JSON.stringify({ sig: flatSig(sig), cases: job.cases.map((c) => c.input) }) },
    user: "main.rb", off, n, args: (from, tok) => ["main.rb", "spec.json", String(from), tok],
  };
}

/** PHP：用户代码开头的 <?php 换成空行 */
const noPhpTag = (code) => code.replace(/^\s*<\?php\b[ \t]*/, "");

// —— PHP ——（判题部分在前面，用户代码挪了 off 行）
function php(job, sig) {
  const code = noPhpTag(clean(job.code)).replace(/\?>\s*$/, "");
  const head = "<?php\n" + L.php.parts.prelude + "\n";
  const off = newlines(head), n = lines(code);
  const main = `
function __jmark($s) {
    global $__jtok;
    echo "\\x01" . $__jtok . ":" . $s . "\\x02";
    flush();
}

function __jwhere($e) {
    $frames = array_merge([['file' => $e->getFile(), 'line' => $e->getLine()]], $e->getTrace());
    foreach ($frames as $f) {
        if (isset($f['file'], $f['line']) && substr($f['file'], -8) === 'main.php' && $f['line'] > ${off} && $f['line'] <= ${off + n}) return '（第 ' . ($f['line'] - ${off}) . ' 行）';
    }
    return '';
}

$__jspec = json_decode(file_get_contents($argv[1]), true);
$__jnames = json_decode(${JSON.stringify(JSON.stringify(entryNames("php", sig))).replace(/\$/g, "\\$")}, true);
$__jtok = $argv[3];
for ($k = (int)$argv[2]; $k < count($__jspec['cases']); $k++) {
    __jmark("S:" . $k);
    try {
        $res = JudgeH::json(JudgeH::runCase($__jspec['sig'], $__jspec['cases'][$k], $__jnames));
        if ($res === false) $res = JudgeH::json(['__error' => '返回值没法转成 JSON：' . json_last_error_msg()]);
    } catch (\\Throwable $e) {
        $res = JudgeH::json(['__error' => get_class($e) . ': ' . $e->getMessage() . __jwhere($e)]);
    }
    __jmark("R:" . $k . ":" . $res);
}
`;
  return {
    files: { "main.php": head + code + "\n" + main, "spec.json": JSON.stringify({ sig: flatSig(sig), cases: job.cases.map((c) => c.input) }) },
    user: "main.php", off, n, args: (from, tok) => ["main.php", "spec.json", String(from), tok],
  };
}

/** Dart：用户写的 import 挪到文件开头（Dart 要求 import 在最前面），原位置留空行，行号不变 */
function dartSplit(code) {
  const imports = [], body = [];
  for (const line of code.split("\n")) {
    if (/^\s*(import|export|library)\s+['"][^'"]+['"][^;]*;\s*$/.test(line) || /^\s*library\s+[\w.]+\s*;\s*$/.test(line)) { imports.push(line.trim()); body.push(""); }
    else body.push(line);
  }
  return { imports, body: body.join("\n") };
}

// —— Dart ——（import 在前面，用户代码挪了 off 行）
function dart(job, sig) {
  const P = L.dart.parts, { imports, body } = dartSplit(clean(job.code));
  const head = [...P.IMPORTS, ...imports.filter((l) => !/^library\b/.test(l))].join("\n") + "\n";
  const off = newlines(head), n = lines(body);
  const cases = job.cases.map((c, k) => `String jCase${k}() {\n  JH.reset();\n  ${P.caseBody(sig, c.input).join("\n  ")}\n}`);
  const main = `
${P.prelude}${usesType(sig, "RandomList") ? P.NODE : ""}
var jTok = '';

String jWhere(StackTrace st) {
  for (final m in RegExp(r'main\\.dart:(\\d+)').allMatches(st.toString())) {
    final l = int.parse(m.group(1)!) - ${off};
    if (l >= 1 && l <= ${n}) return '（第 ' + l.toString() + ' 行）';
  }
  return '';
}

${cases.join("\n\n")}

Future<void> main(List<String> args) async {
  final from = int.parse(args[0]);
  jTok = args[1];
  final cases = <String Function()>[${job.cases.map((_, k) => `jCase${k}`).join(", ")}];
  for (var k = from; k < cases.length; k++) {
    jio.stdout.write('\\x01' + jTok + ':S:' + k.toString() + '\\x02');
    await jio.stdout.flush();
    String res;
    try {
      res = cases[k]();
    } on StackOverflowError catch (_, st) {
      res = '{"__error":' + JH.q('StackOverflowError：递归太深' + jWhere(st)) + '}';
    } catch (e, st) {
      res = '{"__error":' + JH.q(e.toString() + jWhere(st)) + '}';
    }
    jio.stdout.write('\\x01' + jTok + ':R:' + k.toString() + ':' + res + '\\x02');
    await jio.stdout.flush();
  }
}
`;
  return { files: { "main.dart": head + body + "\n" + main }, user: "main.dart", off, n, args: (from, tok) => [String(from), tok] };
}

/** 力扣模式的程序 */
function leetcodeProgram(job) {
  const sig = sigOf(job.sig, job.lang);
  switch (job.lang) {
    case "python": return python(job, sig);
    case "javascript": return script(job, sig, false);
    case "typescript": return script(job, sig, true);
    case "java": return java(job, sig);
    case "cpp": return cpp(job, sig);
    case "go": return go(job, sig);
    case "c": return cLang(job, sig);
    case "csharp": return csharp(job, sig);
    case "kotlin": return kotlin(job, sig);
    case "scala": return scala(job, sig);
    case "swift": return swift(job, sig);
    case "rust": return rust(job, sig);
    case "ruby": return ruby(job, sig);
    case "php": return php(job, sig);
    case "dart": return dart(job, sig);
  }
  throw new Error("不支持的语言：" + job.lang);
}

/** ACM 模式：用户写的就是完整程序，原样编译运行（Java 按 public class 的名字定文件名） */
function acmProgram(job) {
  const code = clean(job.code) + "\n", n = lines(code);
  switch (job.lang) {
    case "python": return { files: { "main.py": code, "solution.py": code }, user: "main.py", off: 0, n, args: () => ["main.py"] };
    case "javascript": return { files: { "main.js": code }, user: "main.js", off: 0, n, args: () => ["main.js"] };
    case "typescript": return { files: { "main.ts": code }, user: "main.ts", off: 0, n, args: () => ["main.ts"] };
    case "java": {
      const m = code.match(/^\s*public\s+(?:final\s+)?class\s+(\w+)/m) || code.match(/^\s*(?:final\s+)?class\s+(Main)\b/m) || code.match(/^\s*(?:final\s+)?class\s+(\w+)/m);
      const cls = m ? m[1] : "Main";
      // package 那一行换成空行：文件直接放在编译目录下
      const src = code.replace(/^\s*package\s+[\w.]+\s*;[ \t]*$/m, "");
      return { files: { [`${cls}.java`]: src }, main: cls, user: `${cls}.java`, off: 0, n, args: () => [] };
    }
    case "cpp": return { files: { "main.cpp": code }, user: "main.cpp", off: 0, n, args: () => [] };
    case "go": return { files: { "sol.go": code }, user: "sol.go", off: 0, n, args: () => [] };
    case "c": return { files: { "main.c": code }, user: "main.c", off: 0, n, args: () => [] };
    case "csharp": return { files: { "globals.cs": L.csharp.parts.GLOBALS, "main.cs": code }, user: "main.cs", harness: ["globals.cs"], off: 0, n, args: () => [] };
    case "kotlin": {
      // 顶层的 fun main 编进 MainKt；写成 object 的就用那个 object
      const obj = code.match(/^\s*object\s+(\w+)/m);
      return { files: { "main.kt": noPackage(code) }, main: /^\s*fun\s+main\s*\(/m.test(code) || !obj ? "MainKt" : obj[1], user: "main.kt", off: 0, n, args: () => [] };
    }
    case "scala": return { files: { "main.scala": noPackage(code) }, main: scalaMain(code), user: "main.scala", off: 0, n, args: () => [] };
    case "swift": return { files: { "main.swift": code }, user: "main.swift", off: 0, n, args: () => [] };
    case "rust": return { files: { "main.rs": code }, user: "main.rs", off: 0, n, args: () => [] };
    case "ruby": return { files: { "main.rb": code }, user: "main.rb", off: 0, n, args: () => ["main.rb"] };
    case "php": {
      // 没写 <?php 时补上（不然 PHP 把代码原样输出），行号挪一行
      const tagged = /^\s*<\?php\b/.test(code);
      return { files: { "main.php": tagged ? code : "<?php\n" + code }, user: "main.php", off: tagged ? 0 : 1, n, args: () => ["main.php"] };
    }
    case "dart": return { files: { "main.dart": code }, user: "main.dart", off: 0, n, args: () => [] };
  }
  throw new Error("不支持的语言：" + job.lang);
}

/** Scala 的 ACM 程序从哪个 object 开始：extends App 的，或者里面有 def main 的；都没有就是 Main */
function scalaMain(code) {
  const objs = [...code.matchAll(/^\s*object\s+(\w+)([^\n{]*)/gm)];
  for (let i = 0; i < objs.length; i++) {
    const body = code.slice(objs[i].index, i + 1 < objs.length ? objs[i + 1].index : undefined);
    if (/\bextends\s+App\b/.test(objs[i][2]) || /\bdef\s+main\s*\(/.test(body)) return objs[i][1];
  }
  return "Main";
}

module.exports = { LANG_IDS, leetcodeProgram, acmProgram, JUDGE };
