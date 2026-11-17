module.exports = {
  id: 394, name: "字符串解码", title: "字符串解码图解", level: "中等", topic: "栈",
  h1: "字符串解码，遇到 [ 先存档，遇到 ] 再展开",
  lede: "括号可以嵌套，所以要先解开里面的。从左往右扫：遇到 [ 时，把括号外已经拼好的前缀和重复次数压栈，开始拼括号里的内容；遇到 ] 时，弹出存档，把括号里的内容重复若干次接到前缀后面。",
  hints: [
    { t: "需要记住什么", body: ["遇到 <code>[</code> 时，括号外面已经有一段拼好的字符串 <code>cur</code>，还有括号前的数字 <code>k</code>。", "这两样都要先存起来，等括号里的内容解完再用。"] },
    { t: "用栈存档", body: ["<code>[</code>：把 <code>(cur, k)</code> 压栈，<code>cur</code> 清空，<code>k</code> 清零。", "<code>]</code>：弹出 <code>(prev, times)</code>，<code>cur = prev + cur * times</code>。", "字母直接接到 <code>cur</code> 后面。"] },
    { t: "数字可能不止一位", body: ["比如 <code>100[a]</code>。读数字时要 <code>k = k * 10 + int(c)</code>。"] },
  ],
  codes: [{ t: "标准解法：栈", code: `
class Solution:
    def decodeString(self, s: str) -> str:
        stack, cur, k = [], "", 0           #@init
        for c in s:
            if c.isdigit():                 #@digit
                k = k * 10 + int(c)         # 数字可能不止一位 #@digit
            elif c == "[":                  #@push
                stack.append((cur, k))      # 存档：括号外的前缀和重复次数 #@push
                cur, k = "", 0              #@push
            elif c == "]":                  #@pop
                prev, times = stack.pop()   #@pop
                cur = prev + cur * times    # 展开后接回前缀 #@pop
            else:                           #@letter
                cur += c                    #@letter
        return cur                          #@done
` }, { t: "简洁写法：正则反复展开最内层", key: "regex", kind: "elegant", note: "「数字[纯字母]」一定是最内层的括号，替换掉它，直到没有括号为止。", code: `
import re

class Solution:
    def decodeString(self, s: str) -> str:
        inner = re.compile(r"(\\d+)\\[([a-z]*)\\]")     #@init
        while "[" in s:                                 #@round
            s = inner.sub(lambda m: m[2] * int(m[1]), s)    #@expand
        return s                                        #@done
` }],
  sig: { fn: "decodeString", params: ["string"], ret: "string" },
  call: (a) => [a.s],
  cases: [["2[abc]3[cd]ef"], ["abc3[cd]xyz"], ["10[a]"], ["3[z]2[2[y]pq4[2[jk]e1[f]]]ef"], ["abc"]],
  pytest: `
s = Solution()
assert s.decodeString("3[a]2[bc]") == "aaabcbc"
assert s.decodeString("3[a2[c]]") == "accaccacc"
assert s.decodeString("2[abc]3[cd]ef") == "abcabccdcdcdef"
assert s.decodeString("abc3[cd]xyz") == "abccdcdcdxyz"
assert s.decodeString("10[a]") == "a" * 10
`,
  method: "栈",
  legend: [["a", "当前字符"], ["d", "已经处理过"]],
  presets: [
    { label: "示例 1", args: { s: "3[a]2[bc]" }, note: "s = \"3[a]2[bc]\"", expect: "aaabcbc" },
    { label: "嵌套", args: { s: "3[a2[c]]" }, note: "s = \"3[a2[c]]\"", expect: "accaccacc" },
  ],
  build(a, snap) {
    const s = a.s, stack = []; let cur = "", k = 0;
    const view = (i) => [
      { t: "array", label: "s", items: s.split("").map((c, j) => ({ v: c, cls: j === i ? "a" : j < i ? "d" : "" })), ptrs: { i: i >= 0 && i < s.length ? i : null } },
      { t: "chips", label: "栈（存档：前缀, 次数）", items: stack.map(([p, t]) => `("${p}", ${t})`), empty: "空" },
    ];
    const f = (at) => ({ at, facts: [["cur", `"${cur}"`], ["k", k]] });
    snap("开始", "cur 是正在拼的字符串，k 是正在读的数字。", view(-1), f("init"));
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (/\d/.test(c)) { k = k * 10 + +c; snap("数字", `读到数字 ${c}，k = <b>${k}</b>。`, view(i), f("digit")); }
      else if (c === "[") { stack.push([cur, k]); snap("存档", `遇到 [，把括号外的前缀 "${cur}" 和次数 ${k} 压栈，cur 清空，开始拼括号里的内容。`, view(i), f("push")); cur = ""; k = 0; }
      else if (c === "]") { const [p, t] = stack.pop(), old = cur; cur = p + cur.repeat(t); snap("展开", `遇到 ]，弹出存档 ("${p}", ${t})。括号里是 "${old}"，重复 ${t} 次接到 "${p}" 后面，cur = <b>"${cur}"</b>。`, view(i), f("pop")); }
      else { cur += c; snap("字母", `字母 ${c} 直接接到 cur 后面。`, view(i), f("letter")); }
    }
    snap("完成", `解码结果是 <b>"${cur}"</b>。`, view(s.length), { kind: "ok", ans: cur, ...f("done") });
  },
  alts: [{
    t: "反复展开最内层",
    code: "regex",
    note: "和简洁写法一样：「数字[纯字母]」里面没有别的括号，一定是最内层。每一轮把所有最内层的括号展开，直到没有括号为止。",
    legend: [["a", "这一轮要展开的最内层"]],
    build(a, snap) {
      let s = a.s, round = 0;
      const view = (hl) => [{ t: "array", label: "s", items: [...s].map((c, i) => ({ v: c, cls: hl.has(i) ? "a" : "" })) }];
      const f = (at) => ({ at, facts: [["轮数", round], ["长度", s.length]] });
      snap("开始", "正则 <code>(\\d+)\\[([a-z]*)\\]</code> 匹配「数字[纯字母]」，它一定是最内层的括号。", view(new Set()), f("init"));
      while (s.includes("[")) {
        round++;
        const re = /(\d+)\[([a-z]*)\]/g, hl = new Set(), parts = [];
        let m;
        while ((m = re.exec(s))) {
          for (let k = m.index; k < m.index + m[0].length; k++) hl.add(k);
          parts.push(`${m[0]} 展开成 "${m[2].repeat(+m[1])}"`);
        }
        snap(`第 ${round} 轮`, `找到 ${parts.length} 个最内层：${parts.join("，")}。`, view(hl), f("round"));
        s = s.replace(/(\d+)\[([a-z]*)\]/g, (_, k, t) => t.repeat(+k));
        snap(`第 ${round} 轮完`, `替换后 s = "${s}"。` + (s.includes("[") ? "还有括号，原来的外层现在变成了最内层，再来一轮。" : "没有括号了。"), view(new Set()), f("expand"));
      }
      snap("完成", `解码结果是 <b>"${s}"</b>。`, view(new Set()), { kind: "ok", ans: s, ...f("done") });
    },
  }],
  points: [
    { t: "存档时 k 要清零", body: "压栈后 k 归零，否则括号里的数字会接在外面的数字后面。" },
    { t: "展开是 prev + cur * times", body: "重复的只是括号里的部分，前缀只出现一次。" },
    { t: "复杂度", body: "时间和空间都和输出长度成正比。" },
  ],
};
