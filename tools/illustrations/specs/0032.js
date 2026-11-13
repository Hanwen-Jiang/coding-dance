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
        stack, best = [-1], 0               # 栈底：最后一个没匹配上的位置
        for i, c in enumerate(s):
            if c == "(":
                stack.append(i)
            else:
                stack.pop()
                if not stack:               # 这个 ) 没人匹配，成为新的分界线
                    stack.append(i)
                else:
                    best = max(best, i - stack[-1])
        return best
` }, { t: "简洁写法：左右各数一遍", kind: "elegant", note: "反过来扫描时把 ) 当成开括号，逻辑完全一样。空间 O(1)。", code: `
class Solution:
    def longestValidParentheses(self, s: str) -> int:
        def scan(s, opener):
            best = l = r = 0
            for c in s:
                if c == opener:
                    l += 1
                else:
                    r += 1
                if l == r:
                    best = max(best, 2 * r)
                elif r > l:
                    l = r = 0
            return best
        return max(scan(s, "("), scan(s[::-1], ")"))
` }],
  pytest: `
s = Solution()
assert s.longestValidParentheses("(()") == 2
assert s.longestValidParentheses(")()())") == 4
assert s.longestValidParentheses("") == 0
assert s.longestValidParentheses("()(())") == 6
assert s.longestValidParentheses("()(()") == 2
assert s.longestValidParentheses("(()))())(") == 4
`,
  legend: [["a", "当前字符"], ["e", "在栈里的下标"], ["c", "以当前位置结尾的有效括号"]],
  presets: [
    { label: "示例 2", args: { s: ")()())" }, note: "s = \")()())\"", expect: 4 },
    { label: "嵌套", args: { s: "()(())" }, note: "s = \"()(())\"", expect: 6 },
    { label: "左括号多", args: { s: "()(()" }, note: "s = \"()(()\"", expect: 2 },
  ],
  build(a, snap) {
    const s = a.s, stack = [-1]; let best = 0;
    const view = (i, seg) => [
      { t: "array", label: "s", items: s.split("").map((c, k) => ({ v: c, cls: seg && k > seg[0] && k <= seg[1] ? "c" : k === i ? "a" : stack.includes(k) ? "e" : "" })), ptrs: { i: i >= 0 ? i : null } },
      { t: "chips", label: "栈（存下标，右边是栈顶）", items: stack.slice(), empty: "空" },
    ];
    const f = () => ({ facts: [["最长", best]] });
    snap("开始", "栈里先放 -1 当分界线：表示「下标 -1 之后的部分」。", view(-1), f());
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "(") { stack.push(i); snap("左括号", `下标 ${i} 是 (，压栈等待匹配。`, view(i), f()); continue; }
      const top = stack.pop();
      if (!stack.length) { stack.push(i); snap("没人匹配", `下标 ${i} 是 )，弹出 ${top} 后栈空了，说明它没有对应的 (。把 ${i} 压进去当新的分界线。`, view(i), { kind: "warn", ...f() }); continue; }
      const len = i - stack[stack.length - 1]; best = Math.max(best, len);
      snap("匹配", `下标 ${i} 是 )，弹出 ${top} 和它配对。栈顶现在是 ${stack[stack.length - 1]}，以 ${i} 结尾的有效括号长度是 ${i} − ${stack[stack.length - 1]} = <b>${len}</b>。`, view(i, [stack[stack.length - 1], i]), f());
    }
    snap("完成", `最长有效括号的长度是 <b>${best}</b>。`, view(-1), { kind: "ok", ans: best, ...f() });
  },
  points: [
    { t: "先弹再判空", body: "遇到 ) 先 pop。pop 之后栈空，说明弹出的是分界线，这个 ) 无法匹配。" },
    { t: "长度用栈顶算", body: "不是 i − 弹出的下标 + 1，而是 i − 新的栈顶。这样能把连在一起的几段有效括号一起算上。" },
    { t: "复杂度", body: "每个下标最多进出栈一次，时间 O(n)，空间 O(n)。双向扫描写法空间 O(1)。" },
  ],
};
