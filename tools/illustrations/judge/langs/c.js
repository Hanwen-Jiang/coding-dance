// C：力扣的写法——数组参数带长度（nums, numsSize），二维数组再带每行长度（matrixColSize），
// 返回数组时多两个出参 int* returnSize、int** returnColumnSizes。所以参数和输出都按签名生成代码，没有运行时的类型信息。
// 只给远端运行器（tools/runner）拼练习程序用；官方题解没有 C 版本。
const fs = require("fs"), path = require("path");
const { fnName, methodName, lcFirst, cStr, charLit, dbl } = require("./names");

/** 用户代码前面：力扣 C 环境里现成的头文件（含 uthash）和节点类型 */
const head = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <stdint.h>
#include <limits.h>
#include <math.h>
#include <ctype.h>
#include <float.h>
#include <assert.h>
#include <uthash.h>

struct ListNode {
    int val;
    struct ListNode *next;
};

struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
};
`;
/** 138 的节点类型；只在用到 RandomList 时带上 */
const NODE_HEAD = `
struct Node {
    int val;
    struct Node *next;
    struct Node *random;
};
`;
/** 用户代码后面 */
const prelude = fs.readFileSync(path.join(__dirname, "../prelude/prelude.c"), "utf8");
const NODE = `
static struct Node **jMade;
static int jMadeN;
static struct Node *jRandom(const int *v, const int *r, int n) {
    free(jMade);
    jMade = (struct Node **)jAlloc(sizeof *jMade * (size_t)n);
    jMadeN = n;
    for (int i = 0; i < n; i++) { jMade[i] = (struct Node *)jAlloc(sizeof(struct Node)); jMade[i]->val = v[i]; }
    for (int i = 0; i < n; i++) { jMade[i]->next = i + 1 < n ? jMade[i + 1] : NULL; jMade[i]->random = r[i] < 0 ? NULL : jMade[r[i]]; }
    return n ? jMade[0] : NULL;
}
static void jRandomOut(JBuf *b, struct Node *h) {
    struct Node **seen = (struct Node **)jAlloc(sizeof *seen * 100001);
    int n = 0;
    for (struct Node *p = h; p && n < 100000; p = p->next) seen[n++] = p;
    for (int i = 0; i < n; i++) for (int k = 0; k < jMadeN; k++) if (seen[i] == jMade[k]) { jQ(b, "没有复制：返回了原链表的节点", -1); free(seen); return; }
    jS(b, "[");
    for (int i = 0; i < n; i++) {
        if (i) jS(b, ",");
        jS(b, "[");
        jI(b, seen[i]->val);
        jS(b, ",");
        if (!seen[i]->random) jS(b, "null");
        else { int k = -1; for (int j = 0; j < n; j++) if (seen[j] == seen[i]->random) { k = j; break; } if (k < 0) jQ(b, "?", -1); else jI(b, k); }
        jS(b, "]");
    }
    jS(b, "]");
    free(seen);
}
`;

const ints = (v) => (v.length ? `(int[]){${v.join(", ")}}` : "NULL");

/** 一个参数：声明语句和传进函数的实参（数组多传长度） */
function param(t, v, a) {
  if (t.base) {
    switch (t.base) {
      case "int": return { decl: [`int ${a} = ${v};`], args: [a] };
      case "long": return { decl: [`long long ${a} = ${v}LL;`], args: [a] };
      case "double": return { decl: [`double ${a} = ${dbl(v)};`], args: [a] };
      case "bool": return { decl: [`bool ${a} = ${v ? "true" : "false"};`], args: [a] };
      case "char": return { decl: [`char ${a} = ${charLit("c", v)};`], args: [a] };
      case "string": { const s = cStr(v); return { decl: [`char *${a} = jStr(${s.lit}, ${s.n});`], args: [a] }; }
      case "ListNode": return { decl: [`struct ListNode *${a} = jList(${ints(v)}, ${v.length});`], args: [a] };
      case "CycleList": return { decl: [`struct ListNode *${a} = jCycle(${ints(v[0])}, ${v[0].length}, ${v[1] === null ? -1 : v[1]});`], args: [a] };
      case "JoinList": return { decl: [`struct ListNode *${a} = jJoin(${ints(v[0])}, ${v[0].length}, ${v[1] === null ? -1 : v[1]});`], args: [a] };
      case "TreeNode": return { decl: [`struct TreeNode *${a} = jTree(${v.length ? `(long long[]){${v.map((x) => (x === null ? "JN" : `${x}LL`)).join(", ")}}` : "NULL"}, ${v.length});`], args: [a] };
      case "TreeRef": return { decl: [`struct TreeNode *${a} = jFind(${v});`], args: [a] };
      case "RandomList": return { decl: [`struct Node *${a} = jRandom(${ints(v.map((x) => x[0]))}, ${ints(v.map((x) => (x[1] === null ? -1 : x[1])))}, ${v.length});`], args: [a] };
    }
    throw new Error("C 不支持的参数类型：" + t.src);
  }
  const it = t.arr, n = v.length;
  if (it.base === "int") return { decl: [`int ${a}n = ${n};`, `int *${a} = jInts(${ints(v)}, ${a}n);`], args: [a, `${a}n`] };
  if (it.base === "long") return { decl: [`int ${a}n = ${n};`, `long long *${a} = jLongs(${n ? `(long long[]){${v.map((x) => x + "LL").join(", ")}}` : "NULL"}, ${a}n);`], args: [a, `${a}n`] };
  if (it.base === "double") return { decl: [`int ${a}n = ${n};`, `double *${a} = jDbls(${n ? `(double[]){${v.map(dbl).join(", ")}}` : "NULL"}, ${a}n);`], args: [a, `${a}n`] };
  if (it.base === "bool") return { decl: [`int ${a}n = ${n};`, `bool *${a} = jBools(${n ? `(bool[]){${v.map((x) => (x ? "true" : "false")).join(", ")}}` : "NULL"}, ${a}n);`], args: [a, `${a}n`] };
  if (it.base === "char") { const s = cStr(v.join("")); return { decl: [`int ${a}n = ${n};`, `char *${a} = jStr(${s.lit}, ${s.n});`], args: [a, `${a}n`] }; }
  if (it.base === "string") return { decl: [`int ${a}n = ${n};`, `char **${a} = (char **)jRows(${a}n);`, ...v.map((s, i) => { const c = cStr(s); return `${a}[${i}] = jStr(${c.lit}, ${c.n});`; })], args: [a, `${a}n`] };
  if (it.base === "ListNode") return { decl: [`int ${a}n = ${n};`, `struct ListNode **${a} = (struct ListNode **)jRows(${a}n);`, ...v.map((x, i) => `${a}[${i}] = jList(${ints(x)}, ${x.length});`)], args: [a, `${a}n`] };
  if (it.arr && it.arr.base === "int") {
    return { decl: [`int ${a}n = ${n};`, `int *${a}c = jInts(${ints(v.map((r) => r.length))}, ${a}n);`, `int **${a} = (int **)jRows(${a}n);`, ...v.map((r, i) => `${a}[${i}] = jInts(${ints(r)}, ${r.length});`)], args: [a, `${a}n`, `${a}c`] };
  }
  if (it.arr && it.arr.base === "char") {
    return { decl: [`int ${a}n = ${n};`, `int *${a}c = jInts(${ints(v.map((r) => r.length))}, ${a}n);`, `char **${a} = (char **)jRows(${a}n);`, ...v.map((r, i) => { const c = cStr(r.join("")); return `${a}[${i}] = jStr(${c.lit}, ${c.n});`; })], args: [a, `${a}n`, `${a}c`] };
  }
  if (it.arr && it.arr.base === "string") {
    return { decl: [`int ${a}n = ${n};`, `int *${a}c = jInts(${ints(v.map((r) => r.length))}, ${a}n);`, `char ***${a} = (char ***)jRows(${a}n);`, ...v.flatMap((r, i) => [`${a}[${i}] = (char **)jRows(${r.length});`, ...r.map((s, j) => { const c = cStr(s); return `${a}[${i}][${j}] = jStr(${c.lit}, ${c.n});`; })])], args: [a, `${a}n`, `${a}c`] };
  }
  throw new Error("C 不支持的参数类型：" + t.src);
}

/** 返回值：声明出参、调用、把结果写进 JSON 的几条语句。call(extra) 生成调用表达式（extra 是 &rs、&rcs 这些出参） */
function result(t, call) {
  if (t.base) {
    switch (t.base) {
      case "int": case "long": return [`long long r = ${call([])};`, "jI(&b, r);"];
      case "double": return [`double r = ${call([])};`, "jD(&b, r);"];
      case "bool": return [`bool r = ${call([])};`, "jB(&b, r);"];
      case "char": return [`char r = ${call([])};`, "jC(&b, r);"];
      case "string": return [`char *r = ${call([])};`, "jQ(&b, r, -1);"];
      case "ListNode": return [`struct ListNode *r = ${call([])};`, "jListOut(&b, r);"];
      case "NodeIndex": return [`struct ListNode *r = ${call([])};`, "jIndex(&b, r);"];
      case "TreeNode": return [`struct TreeNode *r = ${call([])};`, "jTreeOut(&b, r);"];
      case "TreeVal": return [`struct TreeNode *r = ${call([])};`, "jTreeVal(&b, r);"];
      case "RandomList": return [`struct Node *r = ${call([])};`, "jRandomOut(&b, r);"];
    }
    throw new Error("C 不支持的返回类型：" + t.src);
  }
  const it = t.arr;
  if (it.base === "int") return ["int rs = 0;", `int *r = ${call(["&rs"])};`, "jIntsOut(&b, r, rs);"];
  if (it.base === "long") return ["int rs = 0;", `long long *r = ${call(["&rs"])};`, "jLongsOut(&b, r, rs);"];
  if (it.base === "string") return ["int rs = 0;", `char **r = ${call(["&rs"])};`, "jStrsOut(&b, r, rs);"];
  if (it.arr && it.arr.base === "int") return ["int rs = 0;", "int *rcs = NULL;", `int **r = ${call(["&rs", "&rcs"])};`, "jIntsOut2(&b, r, rs, rcs);"];
  if (it.arr && it.arr.base === "string") return ["int rs = 0;", "int *rcs = NULL;", `char ***r = ${call(["&rs", "&rcs"])};`, "jStrsOut2(&b, r, rs, rcs);"];
  throw new Error("C 不支持的返回类型：" + t.src);
}

/** 原地修改的题：调用之后把那个参数写出来 */
function outParam(t, a) {
  if (t.base === "ListNode") return `jListOut(&b, ${a});`;
  if (t.base === "TreeNode") return `jTreeOut(&b, ${a});`;
  if (t.arr && t.arr.base === "int") return `jIntsOut(&b, ${a}, ${a}n);`;
  if (t.arr && t.arr.arr && t.arr.arr.base === "int") return `jIntsOut2(&b, ${a}, ${a}n, ${a}c);`;
  if (t.arr && t.arr.arr && t.arr.arr.base === "char") return `jCharsOut2(&b, ${a}, ${a}n, ${a}c);`;
  throw new Error("C 不支持原地修改这种参数：" + t.src);
}

/** 一个用例的语句（放在一个函数里），最后 jEmit(&b) 输出 */
function caseBody(sig, c) {
  const L = ["JBuf b = {0};"];
  if (sig.kind === "design") {
    const [ops, argv] = c;
    const p0 = argv[0].map((v, i) => param(sig.ctor[i], v, `c${i}`));
    L.push(...p0.flatMap((p) => p.decl), `${sig.cls} *obj = ${lcFirst(sig.cls)}Create(${p0.flatMap((p) => p.args).join(", ")});`, 'jS(&b, "[null");');
    for (let k = 1; k < ops.length; k++) {
      const m = sig.methods[ops[k]], ps = argv[k].map((v, i) => param(m.params[i], v, `m${k}_${i}`));
      const call = (extra) => `${methodName("c", sig.cls, ops[k])}(${["obj", ...ps.flatMap((p) => p.args), ...extra].join(", ")})`;
      L.push('jS(&b, ",");');
      const inner = [...ps.flatMap((p) => p.decl), ...(m.ret.base === "void" ? [`${call([])};`, 'jS(&b, "null");'] : result(m.ret, call))];
      L.push(`{ ${inner.join(" ")} }`);
    }
    L.push(`${lcFirst(sig.cls)}Free(obj);`, 'jS(&b, "]");', "jEmit(&b);");
    return L;
  }
  const ps = c.map((v, i) => param(sig.params[i], v, `a${i}`));
  L.push(...ps.flatMap((p) => p.decl));
  const call = (extra) => `${fnName("c", sig.fn)}(${[...ps.flatMap((p) => p.args), ...extra].join(", ")})`;
  if (sig.ret.base === "void") L.push(`${call([])};`, outParam(sig.params[sig.out], `a${sig.out}`));
  else L.push(...result(sig.ret, call));
  L.push("jEmit(&b);");
  return L;
}

module.exports = { id: "c", parts: { head, NODE_HEAD, prelude, NODE, caseBody } };
