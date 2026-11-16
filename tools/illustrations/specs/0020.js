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
        pairs = {")": "(", "]": "[", "}": "{"}  #@init
        stack = []                      #@init
        for ch in s:
            if ch in pairs:             # 右括号 #@match
                if not stack or stack.pop() != pairs[ch]:  #@match
                    return False        #@bad
            else:                       # 左括号 #@push
                stack.append(ch)        #@push
        return not stack                #@done
` }, { t: "简洁写法：反复删掉相邻的一对", key: "del", kind: "elegant", note: "合法的串里一定有一对相邻的括号，删掉后剩下的仍然合法。一直删到删不动，看是不是空串。时间 O(n²)，胜在直观。", code: `
class Solution:
    def isValid(self, s: str) -> bool:
        while "()" in s or "[]" in s or "{}" in s:  #@round
            s = s.replace("()", "").replace("[]", "").replace("{}", "")  #@del
        return not s                    #@done
` }],
  sig: { fn: "isValid", params: ["string"], ret: "bool" },
  call: (a) => [a.s],
  cases: [["("], [")"], ["]"], ["()"], ["(]"], ["{[]}"], ["(([]){})"]],
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
  method: "栈",
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
    snap("开始", "从左往右看每个字符，栈一开始是空的。", view(-1), { at: "init" });
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (!(ch in pairs)) { stack.push(ch); snap("压栈", `'${ch}' 是左括号，压进栈里，等它的右括号。`, view(i), { at: "push" }); continue; }
      if (!stack.length) { snap("无效", `'${ch}' 是右括号，但栈是空的，前面没有左括号能和它配。返回 false。`, view(i, true), { at: ["match", "bad"], kind: "warn", ans: false }); return; }
      const top = stack.pop();
      if (top !== pairs[ch]) { snap("无效", `'${ch}' 是右括号，栈顶是 '${top}'，不是同一种括号。返回 false。`, view(i, true), { at: ["match", "bad"], kind: "warn", ans: false }); return; }
      snap("配对", `'${ch}' 是右括号，栈顶正好是 '${top}'，配上了，弹出栈顶。`, view(i), { at: "match" });
    }
    if (stack.length) snap("无效", `字符串走完了，但栈里还剩 ${stack.length} 个左括号没关上。返回 false。`, view(s.length), { at: "done", kind: "warn", ans: false });
    else snap("完成", "字符串走完，栈也空了，每个括号都配上了。返回 true。", view(s.length), { at: "done", kind: "ok", ans: true });
  },
  alts: [{
    t: "反复删一对",
    code: "del",
    note: "和简洁写法一样：每一轮依次把所有 ()、[]、{} 删掉，删到删不动为止。合法的串最后一定删成空串。",
    legend: [["a", "这一下要删掉的一对"]],
    build(a, snap) {
      let s = a.s, round = 0;
      const view = (hl) => [s.length
        ? { t: "array", label: "s", items: [...s].map((v, t) => ({ v, cls: hl.has(t) ? "a" : "" })) }
        : { t: "note", label: "s", html: "空串" }];
      const f = () => ({ facts: [["轮数", round], ["剩下", s.length]] });
      const has = () => ["()", "[]", "{}"].some((p) => s.includes(p));
      snap("开始", "合法的串里一定有一对挨在一起的括号。把它们删掉，剩下的部分合法性不变。", view(new Set()), { at: "round", ...f() });
      while (has()) {
        round++;
        for (const p of ["()", "[]", "{}"]) {
          const hl = new Set();
          for (let k = s.indexOf(p); k >= 0; k = s.indexOf(p, k + 2)) { hl.add(k); hl.add(k + 1); }
          if (!hl.size) continue;
          snap(`第 ${round} 轮`, `找到 ${hl.size / 2} 对相邻的 <code>${p}</code>，全部删掉。`, view(hl), { at: "del", ...f() });
          s = s.split(p).join("");
        }
        snap(`第 ${round} 轮完`, s.length ? (has() ? `删完变成 "${s}"，里面又出现了相邻的一对，再来一轮。` : `删完变成 "${s}"，已经没有相邻的一对了。`) : "删成空串了。", view(new Set()), { at: "round", ...f() });
      }
      if (s.length) snap("无效", `删不动了，还剩 "${s}"，说明有括号配不上。返回 false。`, view(new Set()), { at: "done", kind: "warn", ans: false, ...f() });
      else snap("完成", "整个串都删光了，每个括号都配上了。返回 true。", view(new Set()), { at: "done", kind: "ok", ans: true, ...f() });
    },
  }],
  points: [
    { t: "弹栈前先看栈空不空", body: "遇到右括号而栈是空的，直接无效。不判断的话 <code>pop</code> 会报错。" },
    { t: "最后返回 not stack", body: "走完字符串不代表有效，栈里可能还有没关的左括号。" },
    { t: "复杂度", body: "每个字符处理一次，时间 O(n)，空间 O(n)。" },
  ],
};
