module.exports = {
  id: 32, name: "最长有效括号", title: "最长有效括号图解", level: "困难", topic: "动态规划",
  h1: "最长有效括号，栈底放分界线",
  lede: "用栈存下标。左括号的下标入栈等待匹配；右括号来了就弹出一个。栈底始终放着「最后一个没被匹配的位置」，当前位置减去栈顶，就是以这里结尾的有效括号长度。",
  hints: [
    { t: "栈里放下标", body: ["遇到 <code>(</code> 把下标压栈；遇到 <code>)</code> 弹出栈顶，表示匹配了一对。", "要算长度，所以存下标而不是字符。"] },
    { t: "栈底放一个分界线", body: ["一开始压入 <code>-1</code>。弹出后栈不空，<code>i - stack[-1]</code> 就是以 <code>i</code> 结尾的有效长度。", "弹出后栈空了，说明这个 <code>)</code> 没人匹配，它成了新的分界线，把 <code>i</code> 压进去。"] },
    { t: "也可以不用栈", body: ["从左往右数左右括号个数，相等时更新答案，右括号多了就清零。", "再从右往左数一遍，处理 <code>(()</code> 这种左括号一直多的情况。"] },
  ],
  codes: [{ t: "标准解法：栈", code: `
class Solution:
    def longestValidParentheses(self, s: str) -> int:
        stack, best = [-1], 0               # 栈底：最后一个没匹配上的位置 #@init
        for i, c in enumerate(s):
            if c == "(":                    #@open
                stack.append(i)             #@open
            else:                           #@lone,match
                stack.pop()                 #@lone,match
                if not stack:               # 这个 ) 没人匹配，成为新的分界线 #@lone,match
                    stack.append(i)         #@lone
                else:                       #@match
                    best = max(best, i - stack[-1])     #@match
        return best                         #@done
` }, { t: "简洁写法：左右各数一遍", key: "scan", kind: "elegant", note: "反过来扫描时把 ) 当成开括号，逻辑完全一样。空间 O(1)。", code: `
class Solution:
    def longestValidParentheses(self, s: str) -> int:
        def scan(s, opener):
            best = l = r = 0                #@fwd,back
            for c in s:
                if c == opener:             #@count
                    l += 1                  #@count
                else:
                    r += 1                  #@count
                if l == r:                  #@eq
                    best = max(best, 2 * r) #@eq
                elif r > l:                 #@reset
                    l = r = 0               #@reset
            return best
        return max(scan(s, "("), scan(s[::-1], ")"))   #@fwd,back,done
` }],
  sig: { fn: "longestValidParentheses", params: ["string"], ret: "int" },
  call: (a) => [a.s],
  cases: [[""], ["("], [")"], ["()"], ["(()"], ["(()))())("], ["((()))"]],
  pytest: `
s = Solution()
assert s.longestValidParentheses("(()") == 2
assert s.longestValidParentheses(")()())") == 4
assert s.longestValidParentheses("") == 0
assert s.longestValidParentheses("()(())") == 6
assert s.longestValidParentheses("()(()") == 2
assert s.longestValidParentheses("(()))())(") == 4
`,
  method: "栈",
  legend: [["a", "当前字符"], ["e", "在栈里的下标"], ["c", "以当前位置结尾的有效括号"]],
  presets: [
    { label: "示例 2", args: { s: ")()())" }, note: "s = \")()())\"", expect: 4 },
    { label: "嵌套", args: { s: "()(())" }, note: "s = \"()(())\"", expect: 6 },
    { label: "左括号多", args: { s: "()(()" }, note: "s = \"()(()\"", expect: 2 },
  ],
  build(a, snap) {
    const s = a.s, stack = [-1]; let best = 0;
    const view = (i, seg, opts = {}) => [
      {
        t: "array",
        label: "s",
        items: s.split("").map((c, k) => ({ v: c, cls: seg && k > seg[0] && k <= seg[1] ? "c" : k === i ? "a" : stack.includes(k) ? "e" : "" })),
        ptrs: { i: i >= 0 ? i : null },
        feeds: (opts.feeds || []).slice(),
      },
      { t: "chips", label: "栈（存下标，右边是栈顶）", items: stack.slice(), empty: "空" },
    ];
    snap("开始", "栈里先放 -1 当分界线：表示「下标 -1 之后的部分」。", view(-1), {
      at: "init",
      facts: [["最长 best", 0], ["栈顶", -1]],
    });
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") {
        stack.push(i);
        snap("左括号", `下标 ${i} 是 (，压栈等待匹配。`, view(i), {
          at: "open",
          facts: [["字符", "'('"], ["入栈下标", i], ["最长 best", best]],
        });
        continue;
      }
      const top = stack.pop();
      if (!stack.length) {
        stack.push(i);
        snap("没人匹配", `下标 ${i} 是 )，弹出 ${top} 后栈空了，说明它没有对应的 (。把 ${i} 压进去当新的分界线。`, view(i), {
          at: "lone",
          kind: "warn",
          facts: [["弹出分界线", top], ["新分界线", i], ["最长 best", best]],
        });
        continue;
      }
      const base = stack[stack.length - 1];
      const len = i - base;
      const oldBest = best;
      best = Math.max(best, len);
      snap("匹配", `下标 ${i} 是 )，弹出 ${top} 和它配对。栈顶现在是 ${base}，以 ${i} 结尾的有效括号长度是 ${i} − ${base} = <b>${len}</b>。`, view(i, [base, i], {
        feeds: [{ from: top, to: i, win: true, label: `len=${len}` }],
      }), {
        at: "match",
        facts: [
          ["配对", `${top}↔${i}`],
          ["当前长度", len],
          best !== oldBest ? ["最长 best", best, oldBest] : ["最长 best", best],
        ],
      });
    }
    snap("完成", `最长有效括号的长度是 <b>${best}</b>。`, view(-1), {
      at: "done",
      kind: "ok",
      ans: best,
      facts: [["最长 best", best]],
    });
  },
  alts: [{
    t: "左右各数一遍",
    code: "scan",
    note: "从左往右数 ( 和 ) 的个数：一样多就是一段有效括号，) 多了就清零重来。左括号多出来的情况这样数不出来，所以再从右往左数一遍。",
    legend: [["a", "当前字符"], ["c", "从计数起点到这里，( 和 ) 一样多"]],
    build(a, snap) {
      const s = a.s, n = s.length; let best = 0;
      const view = (i, seg, dir, opts = {}) => [{
        t: "array",
        label: dir ? "s（从左往右数）" : "s（从右往左数，把 ) 当开括号）",
        items: [...s].map((c, k) => ({ v: c, cls: k === i ? "a" : seg && k >= seg[0] && k <= seg[1] ? "c" : "" })),
        ptrs: { i: i >= 0 && i < n ? i : null },
        feeds: (opts.feeds || []).slice(),
      }];
      const pass = (fw) => {
        const open = fw ? "(" : ")";
        let l = 0, r = 0, st = fw ? 0 : n - 1;
        for (let t = 0; t < n; t++) {
          const i = fw ? t : n - 1 - t, c = s[i];
          const oldOpenCnt = fw ? l : r, oldCloseCnt = fw ? r : l;
          if (c === open) l++; else r++;
          const curOpenCnt = fw ? l : r, curCloseCnt = fw ? r : l;
          const seg = fw ? [st, i] : [i, st];
          if (l === r) {
            const oldBest = best;
            const len = 2 * r;
            const up = len > best;
            best = Math.max(best, len);
            snap(
              "一样多",
              `下标 ${i} 是 ${c}。( 和 ) 都是 ${l} 个，${fw ? `从 ${st} 到 ${i}` : `从 ${i} 到 ${st}`} 是一段长 ${len} 的有效括号。` + (up ? "比之前的都长。" : ""),
              view(i, seg, fw, { feeds: [{ from: st, to: i, win: true, label: `len=${len}` }] }),
              {
                at: ["count", "eq"],
                kind: up ? "ok" : "",
                facts: [
                  curOpenCnt !== oldOpenCnt ? ["( 的个数", curOpenCnt, oldOpenCnt] : ["( 的个数", curOpenCnt],
                  curCloseCnt !== oldCloseCnt ? [") 的个数", curCloseCnt, oldCloseCnt] : [") 的个数", curCloseCnt],
                  best !== oldBest ? ["最长 best", best, oldBest] : ["最长 best", best],
                ],
              },
            );
          } else if (r > l) {
            l = r = 0; st = fw ? i + 1 : i - 1;
            snap(
              "清零",
              `下标 ${i} 是 ${c}，${fw ? ")" : "("} 比 ${open} 多了，这一段不可能再变有效。两个计数清零，从下一格重新数。`,
              view(i, null, fw),
              {
                at: ["count", "reset"],
                kind: "warn",
                facts: [
                  curOpenCnt !== 0 ? ["( 的个数", 0, curOpenCnt] : ["( 的个数", 0],
                  curCloseCnt !== 0 ? [") 的个数", 0, curCloseCnt] : [") 的个数", 0],
                  ["最长 best", best],
                ],
              },
            );
          } else {
            snap("继续", `下标 ${i} 是 ${c}。${open} 比另一种多，后面还可能补上，继续数。`, view(i, seg, fw), {
              at: "count",
              facts: [
                curOpenCnt !== oldOpenCnt ? ["( 的个数", curOpenCnt, oldOpenCnt] : ["( 的个数", curOpenCnt],
                curCloseCnt !== oldCloseCnt ? [") 的个数", curCloseCnt, oldCloseCnt] : [") 的个数", curCloseCnt],
                ["最长 best", best],
              ],
            });
          }
        }
      };
      snap("从左往右", "先从左往右数。( 和 ) 一样多时，从计数起点到这里就是一段有效括号；) 多了就清零。", view(-1, null, true), { at: "fwd", facts: [["最长 best", 0]] });
      pass(true);
      snap("换方向", `只从左往右数，会漏掉 ( 一直比 ) 多的情况（比如 "(()"，两个计数永远等不到相等）。所以再从右往左数一遍，这次把 ) 当成开括号。`, view(-1, null, false), { at: "back", facts: [["最长 best", best]] });
      pass(false);
      snap("完成", `两遍都数完了，最长有效括号的长度是 <b>${best}</b>。`, view(-1, null, true), { at: "done", kind: "ok", ans: best, facts: [["最长 best", best]] });
    },
  }],
  points: [
    { t: "先弹再判空", body: "遇到 ) 先 pop。pop 之后栈空，说明弹出的是分界线，这个 ) 无法匹配。" },
    { t: "长度用栈顶算", body: "不是 i − 弹出的下标 + 1，而是 i − 新的栈顶。这样能把连在一起的几段有效括号一起算上。" },
    { t: "复杂度", body: "每个下标最多进出栈一次，时间 O(n)，空间 O(n)。双向扫描写法空间 O(1)。" },
  ],
};
