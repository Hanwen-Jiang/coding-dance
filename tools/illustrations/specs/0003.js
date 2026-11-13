module.exports = {
  id: 3, name: "无重复字符的最长子串", title: "无重复字符的最长子串图解", level: "中等", topic: "滑动窗口",
  h1: "无重复字符的最长子串，窗口右边进、左边出",
  lede: "维护一个里面没有重复字符的窗口。右端每次吞进一个新字符，如果它和窗口里的字符重复了，就从左端一个个吐出去，直到不重复为止。",
  hints: [
    { t: "子串是连续的", body: ["子串必须连续，所以可以用左右两个下标 <code>l</code>、<code>r</code> 表示一段窗口。", "目标是让窗口里始终没有重复字符，并记录它出现过的最大长度。"] },
    { t: "右端怎么动", body: ["<code>r</code> 每次右移一格，把新字符放进窗口。", "用一个集合记录窗口里现在有哪些字符，判断重复就是 <code>O(1)</code>。"] },
    { t: "出现重复怎么办", body: ["新字符已经在集合里时，从左端不断移出字符、<code>l</code> 右移，直到集合里没有这个字符。", "每个字符最多进一次、出一次，所以总共是 <code>O(n)</code>。"] },
  ],
  codes: [{ t: "标准解法：滑动窗口 + 集合", code: `
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        seen = set()                    # 窗口里的字符
        l = best = 0
        for r, ch in enumerate(s):
            while ch in seen:           # 有重复，左端收缩
                seen.remove(s[l])
                l += 1
            seen.add(ch)
            best = max(best, r - l + 1)
        return best
` }],
  pytest: `
s = Solution()
assert s.lengthOfLongestSubstring("abcabcbb") == 3
assert s.lengthOfLongestSubstring("bbbbb") == 1
assert s.lengthOfLongestSubstring("pwwkew") == 3
assert s.lengthOfLongestSubstring("") == 0
assert s.lengthOfLongestSubstring("abba") == 2
`,
  legend: [["e", "窗口里的字符"], ["a", "刚进来的字符"], ["b", "被移出的字符"], ["d", "窗口左边"]],
  presets: [
    { label: "示例 1", args: { s: "abcabcbb" }, note: 's = "abcabcbb"', expect: 3 },
    { label: "示例 3", args: { s: "pwwkew" }, note: 's = "pwwkew"', expect: 3 },
    { label: "abba", args: { s: "abba" }, note: 's = "abba"', expect: 2 },
  ],
  build(a, snap) {
    const s = a.s, seen = new Set(); let l = 0, best = 0;
    const view = (r, out) => [
      { t: "array", label: "s", items: [...s].map((v, i) => ({ v, cls: i === out ? "b" : i === r ? "a" : i >= l && i < r ? "e" : i < l ? "d" : "" })), ptrs: { l, r } },
      { t: "chips", label: "集合 seen", items: [...seen] },
    ];
    const facts = (r) => [["最长", best], ["窗口长度", Math.max(0, r - l + 1)]];
    snap("开始", "窗口一开始是空的，l 和 r 都在最左边。", view(-1), { facts: [["最长", 0]] });
    for (let r = 0; r < s.length; r++) {
      const ch = s[r];
      while (seen.has(ch)) {
        seen.delete(s[l]);
        snap("收缩", `新字符 '${ch}' 已经在窗口里。把最左边的 '${s[l]}' 移出去，l 右移。`, view(r, l), { kind: "warn", facts: facts(r - 1) });
        l++;
      }
      seen.add(ch); best = Math.max(best, r - l + 1);
      snap("扩张", `'${ch}' 不在窗口里，放进来。窗口是 "${s.slice(l, r + 1)}"，长度 ${r - l + 1}。`, view(r), { facts: facts(r) });
    }
    snap("完成", `r 走到头了。最长的无重复子串长度是 <b>${best}</b>。`, view(s.length), { kind: "ok", ans: best, facts: [["最长", best]] });
  },
  points: [
    { t: "while 不是 if", body: "重复的那个字符可能不在最左边，要一直移到它被移出去为止。" },
    { t: "先收缩再加入", body: "先把窗口缩到不含 <code>ch</code>，再把 <code>ch</code> 加进集合，最后更新答案。" },
    { t: "更快的写法", body: "用字典记每个字符上次出现的下标，重复时 <code>l</code> 可以直接跳到那个下标的右边。" },
  ],
};
