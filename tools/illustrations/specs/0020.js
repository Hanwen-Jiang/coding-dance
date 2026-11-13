module.exports = {
  id: 20, name: "有效的括号", title: "有效的括号图解", level: "简单", topic: "栈",
  h1: "有效的括号，最后打开的要最先关上",
  lede: "括号的规则是后开的先关：遇到右括号时，它要配的一定是离它最近、还没配上的那个左括号。这正是栈的特点，后放进去的先拿出来。",
  hints: [
    { t: "右括号要和谁配", body: ["看 <code>([)]</code>：<code>)</code> 出现时，离它最近的未闭合左括号是 <code>[</code>，类型不对，所以无效。", "每个右括号都只和「最近的、还没配对的左括号」比较。"] },
    { t: "用栈记住没配对的左括号", body: ["遇到左括号：压栈。", "遇到右括号：弹出栈顶，看是不是同一种括号。不是，或者栈已经空了，就无效。"] },
    { t: "最后还要看一眼", body: ["字符串走完后，栈必须是空的。", "栈里还有东西，说明有左括号没关上，比如 <code>((</code>。"] },
  ],
  codes: [{ t: "标准解法：栈", code: `
class Solution:
    def isValid(self, s: str) -> bool:
        pairs = {")": "(", "]": "[", "}": "{"}
        stack = []
        for ch in s:
            if ch in pairs:             # 右括号
                if not stack or stack.pop() != pairs[ch]:
                    return False
            else:                       # 左括号
                stack.append(ch)
        return not stack
` }],
  pytest: `
s = Solution()
assert s.isValid("()") is True
assert s.isValid("()[]{}") is True
assert s.isValid("(]") is False
assert s.isValid("([)]") is False
assert s.isValid("{[]}") is True
assert s.isValid("((") is False
assert s.isValid(")") is False
`,
  legend: [["a", "当前字符"], ["d", "已经处理"], ["e", "栈里等待配对的左括号"]],
  presets: [
    { label: "嵌套", args: { s: "{[()]}" }, note: 's = "{[()]}"', expect: true },
    { label: "交叉", args: { s: "([)]" }, note: 's = "([)]"', expect: false },
    { label: "没关上", args: { s: "()((" }, note: 's = "()(("', expect: false },
    { label: "多了右括号", args: { s: "())" }, note: 's = "())"', expect: false },
  ],
  build(a, snap) {
    const s = a.s, pairs = { ")": "(", "]": "[", "}": "{" }, stack = [];
    const view = (i, bad) => [
      { t: "array", label: "s", items: [...s].map((v, t) => ({ v, cls: t === i ? (bad ? "b" : "a") : t < i ? "d" : "" })), ptrs: { i: i >= 0 && i < s.length ? i : null } },
      { t: "chips", label: "栈（右边是栈顶）", items: stack.map((v, t) => ({ v, cls: t === stack.length - 1 ? "e" : "" })) },
    ];
    snap("开始", "从左往右看每个字符，栈一开始是空的。", view(-1));
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (!(ch in pairs)) { stack.push(ch); snap("压栈", `'${ch}' 是左括号，压进栈里，等它的右括号。`, view(i)); continue; }
      if (!stack.length) { snap("无效", `'${ch}' 是右括号，但栈是空的，前面没有左括号能和它配。返回 false。`, view(i, true), { kind: "warn", ans: false }); return; }
      const top = stack.pop();
      if (top !== pairs[ch]) { snap("无效", `'${ch}' 是右括号，栈顶是 '${top}'，不是同一种括号。返回 false。`, view(i, true), { kind: "warn", ans: false }); return; }
      snap("配对", `'${ch}' 是右括号，栈顶正好是 '${top}'，配上了，弹出栈顶。`, view(i));
    }
    if (stack.length) snap("无效", `字符串走完了，但栈里还剩 ${stack.length} 个左括号没关上。返回 false。`, view(s.length), { kind: "warn", ans: false });
    else snap("完成", "字符串走完，栈也空了，每个括号都配上了。返回 true。", view(s.length), { kind: "ok", ans: true });
  },
  points: [
    { t: "弹栈前先看栈空不空", body: "遇到右括号而栈是空的，直接无效。不判断的话 <code>pop</code> 会报错。" },
    { t: "最后返回 not stack", body: "走完字符串不代表有效，栈里可能还有没关的左括号。" },
    { t: "复杂度", body: "每个字符处理一次，时间 O(n)，空间 O(n)。" },
  ],
};
