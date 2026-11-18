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
};
const LANG_IDS = ["python", "java", "cpp", "go", "javascript", "typescript"];

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
  }
  throw new Error("不支持的语言：" + job.lang);
}

module.exports = { LANG_IDS, leetcodeProgram, acmProgram, JUDGE };
