/*
 * JS / TS 调试用的源码改写（只在调试时用，运行在练习的 Worker 里）。用 TypeScript 的解析器找到每条语句，在原文上插入记录调用：
 *   每条语句前   __step(行号, () => __snap({ a: () => a, b: () => b }))   —— 记下执行到这一行、当时看得到的变量；
 *   return x     return __ret(行号, 变量快照, (x))                         —— 记下返回值；
 *   函数体       __enter("名字"); try { … } catch (e) { __exc(e); throw e } finally { __exit() }  —— 调用栈和异常。
 * 变量用「取值函数」传进去，由 kernel.js 的 __snap 一个个取，取不到的（暂时性死区、不在作用域里）就跳过，所以不用精确分析作用域：
 * 把外层各个作用域里声明过的名字都列上就行。改写后的源码再交给 TypeScript 转成 JS（TS）或者直接运行（JS）。
 */
(function () {
  function instrument(ts, source, language, mode, watch) {
    const fileName = language === "typescript" ? "solution.ts" : "solution.js";
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, language === "typescript" ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const edits = []; // { pos, text, close, depth }
    const add = (pos, text, close, depth) => edits.push({ pos, text, close, depth, seq: edits.length });

    // 过滤用户输入的追踪表达式：去重、上限 20 条、用 TS 解析器校验为合法表达式，避免破坏源码插桩
    const validWatches = [];
    if (Array.isArray(watch)) {
      const seenWatch = new Set();
      for (const rawExpr of watch) {
        if (typeof rawExpr !== "string") continue;
        const expr = rawExpr.trim();
        if (!expr || seenWatch.has(expr)) continue;
        seenWatch.add(expr);
        try {
          const wf = ts.createSourceFile("watch.ts", `(${expr})`, ts.ScriptTarget.ES2022, false, ts.ScriptKind.TS);
          if (!wf.parseDiagnostics || wf.parseDiagnostics.length === 0) validWatches.push(expr);
        } catch { /* ignore invalid expression */ }
        if (validWatches.length >= 20) break;
      }
    }

    const bindingNames = (name, out) => {
      if (!name) return;
      if (ts.isIdentifier(name)) out.push(name.text);
      else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindingNames(el.name, out);
    };
    /** 一个语句列表里直接声明的变量（let / const / var） */
    const declared = (statements) => {
      const out = [];
      for (const st of statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) bindingNames(d.name, out);
      return out;
    };
    /** 函数体里所有的 var（会提升到整个函数），不进内层函数 */
    const hoisted = (node) => {
      const out = [];
      const walk = (n) => {
        if (n !== node && (ts.isFunctionLike(n) || ts.isClassLike(n))) return;
        if (ts.isVariableDeclarationList(n) && !(n.flags & ts.NodeFlags.BlockScoped)) for (const d of n.declarations) bindingNames(d.name, out);
        ts.forEachChild(n, walk);
      };
      walk(node);
      return out;
    };

    const scopes = []; // 每层一个名字数组
    let thisOk = false; // 最近的普通函数是类的方法 / 构造函数：快照里带上 this
    const IDENT = /^[A-Za-z_$][\w$]*$/;
    const snapshot = () => {
      const names = [...new Set(scopes.flat())].filter((n) => IDENT.test(n) && !n.startsWith("__"));
      const parts = names.map((n) => `${n}: () => ${n}`);
      if (thisOk) parts.push("this: () => this");
      if (!validWatches.length) return `() => __snap({ ${parts.join(", ")} })`;
      const watchParts = validWatches.map((expr) => `[${JSON.stringify(expr)}, () => (${expr})]`);
      return `() => __snap({ ${parts.join(", ")} }, [${watchParts.join(", ")}])`;
    };
    const SKIP = (st) => ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)
      || ts.isModuleDeclaration(st) || ts.isImportDeclaration(st) || ts.isExportDeclaration(st) || ts.isEmptyStatement(st)
      || (st.modifiers && st.modifiers.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword));

    const fnName = (fn) => {
      if (ts.isConstructorDeclaration(fn)) return "constructor";
      if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
      if (fn.name && (ts.isStringLiteral(fn.name) || ts.isNumericLiteral(fn.name))) return fn.name.text;
      const p = fn.parent;
      if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
      if (p && (ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)) && p.name && ts.isIdentifier(p.name)) return p.name.text;
      if (p && ts.isBinaryExpression(p) && ts.isPropertyAccessExpression(p.left)) return p.left.name.text;
      return "(匿名函数)";
    };

    /** 一条语句前插记录；不是语句块的单条语句（if / 循环的身体）先用 { } 包起来。第三个参数是语句的编号（同一行上的两条语句合成一步用） */
    let statementId = 0;
    const stepBefore = (st, depth, wrap) => {
      if (SKIP(st)) return;
      if (wrap) add(st.getStart(sf), "{ ", false, depth);
      add(st.getStart(sf), `__step(${lineOf(st)}, ${snapshot()}, ${++statementId}); `, false, depth + 0.5);
      if (wrap) add(st.end, " }", true, depth);
    };

    const visitList = (statements, depth, topLevel) => {
      scopes.push(declared(statements));
      for (const st of statements) {
        if (!(topLevel && mode !== "acm")) stepBefore(st, depth, false); // 力扣模式不记最外层（定义 class、函数的那几行）
        visit(st, depth + 1);
      }
      scopes.pop();
    };

    const body = (stmt, depth) => {
      if (!stmt) return;
      if (ts.isBlock(stmt)) { visit(stmt, depth); return; }
      stepBefore(stmt, depth, true);
      visit(stmt, depth + 1);
    };

    function visitFunction(fn, depth) {
      const names = [];
      for (const p of fn.parameters || []) bindingNames(p.name, names);
      const savedThis = thisOk;
      if (!ts.isArrowFunction(fn)) thisOk = ts.isMethodDeclaration(fn) || ts.isConstructorDeclaration(fn) || ts.isGetAccessor(fn) || ts.isSetAccessor(fn);
      if (fn.body && ts.isBlock(fn.body) && !fn.body.statements.length) {
        // 空函数体（比如只有参数属性的构造函数）：没什么可记的，也不包 try（开头和结尾插在同一个位置会弄反）
      } else if (fn.body && ts.isBlock(fn.body)) {
        scopes.push([...names, ...hoisted(fn.body)]);
        const open = fn.body.getStart(sf) + 1, close = fn.body.end - 1;
        add(open, ` __enter(${JSON.stringify(fnName(fn))}); try {`, false, depth);
        visitList(fn.body.statements, depth + 1, false);
        add(close, ` } catch (__e) { __exc(__e); throw __e; } finally { __exit(); } `, true, depth);
        scopes.pop();
      } else if (fn.body) {
        // 箭头函数的表达式身体：没有语句，只往里找内层函数
        scopes.push(names);
        visit(fn.body, depth + 1);
        scopes.pop();
      }
      thisOk = savedThis;
    }

    function visit(node, depth) {
      if (ts.isFunctionLike(node) && node.body !== undefined) { visitFunction(node, depth); return; }
      if (ts.isBlock(node) || ts.isModuleBlock(node)) { visitList(node.statements, depth, false); return; }
      if (ts.isCaseClause(node) || ts.isDefaultClause(node)) { visitList(node.statements, depth, false); return; }
      if (ts.isIfStatement(node)) {
        visit(node.expression, depth);
        body(node.thenStatement, depth);
        if (node.elseStatement) body(node.elseStatement, depth);
        return;
      }
      if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) {
        const names = [];
        const init = node.initializer;
        if (init && ts.isVariableDeclarationList(init)) for (const d of init.declarations) bindingNames(d.name, names);
        scopes.push(names);
        if (init) visit(init, depth);
        if (ts.isForStatement(node)) { if (node.condition) visit(node.condition, depth); if (node.incrementor) visit(node.incrementor, depth); }
        else visit(node.expression, depth);
        body(node.statement, depth);
        scopes.pop();
        return;
      }
      if (ts.isWhileStatement(node) || ts.isDoStatement(node)) { visit(node.expression, depth); body(node.statement, depth); return; }
      if (ts.isCatchClause(node)) {
        const names = [];
        if (node.variableDeclaration) bindingNames(node.variableDeclaration.name, names);
        scopes.push(names);
        visit(node.block, depth);
        scopes.pop();
        return;
      }
      if (ts.isReturnStatement(node)) {
        const line = lineOf(node);
        if (node.expression) {
          visit(node.expression, depth);
          add(node.expression.getStart(sf), `__ret(${line}, ${snapshot()}, (`, false, depth + 0.75);
          add(node.expression.end, "))", true, depth + 0.75);
        } else {
          add(node.getStart(sf) + "return".length, ` __ret(${line}, ${snapshot()}, undefined)`, false, depth + 0.75);
        }
        return;
      }
      ts.forEachChild(node, (child) => visit(child, depth + 1));
    }

    visitList(sf.statements, 0, true);

    // 同一个位置上：先收尾（内层的先收），再开头（外层的先开）
    edits.sort((a, b) => a.pos - b.pos || (a.close === b.close ? (a.close ? b.depth - a.depth : a.depth - b.depth) || a.seq - b.seq : a.close ? -1 : 1));
    let out = "", at = 0;
    for (const e of edits) { out += source.slice(at, e.pos) + e.text; at = e.pos; }
    out += source.slice(at);
    return out;
  }
  globalThis.PracticeInstrument = instrument;
})();
