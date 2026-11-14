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
` }, { t: "简洁写法：记住每个字符上次出现的位置", kind: "elegant", note: "重复字符在窗口里时，左边界直接跳到它上次出现位置的下一格，不用一步一步收缩。", code: `
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        last, left, best = {}, 0, 0
        for i, c in enumerate(s):
            if last.get(c, -1) >= left:     # c 在窗口里出现过
                left = last[c] + 1
            last[c] = i
            best = max(best, i - left + 1)
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
  method: "集合 + 收缩",
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
  alts: [{
    t: "字典 + 跳转",
    note: "用字典记每个字符上次出现的下标。新字符在窗口里出现过时，左边界一步跳到它上次出现位置的右边，不用一格一格收缩。",
    legend: [["e", "窗口里的字符"], ["a", "刚进来的字符"], ["b", "它上次出现的位置"], ["d", "窗口左边"]],
    build(a, snap) {
      const s = a.s, last = {}; let left = 0, best = 0;
      const view = (i, prev) => [
        { t: "array", label: "s", items: [...s].map((v, t) => ({ v, cls: t === prev ? "b" : t === i ? "a" : t >= left && t < i ? "e" : t < left ? "d" : "" })), ptrs: { left, i: i >= 0 && i < s.length ? i : null } },
        { t: "chips", label: "last：每个字符上次出现的下标", items: Object.keys(last).map((c) => `${c} → ${last[c]}`), empty: "空" },
      ];
      const facts = (i) => ({ facts: [["最长", best], ["窗口长度", Math.max(0, i - left + 1)]] });
      snap("开始", "字典 last 是空的，左边界 left = 0。", view(-1, -1), { facts: [["最长", 0]] });
      for (let i = 0; i < s.length; i++) {
        const c = s[i], p = c in last ? last[c] : -1;
        if (p >= left) {
          const old = left;
          left = p + 1; last[c] = i; best = Math.max(best, i - left + 1);
          snap("跳", `'${c}' 上次出现在下标 ${p}，还在窗口 [${old}, ${i - 1}] 里。left 直接从 ${old} 跳到 ${p} + 1 = <b>${left}</b>，窗口变成 "${s.slice(left, i + 1)}"。`, view(i, p), { kind: "warn", ...facts(i) });
        } else {
          last[c] = i; best = Math.max(best, i - left + 1);
          snap("扩张", (p >= 0 ? `'${c}' 上次出现在下标 ${p}，已经在窗口左边了，不算重复。` : `'${c}' 第一次出现。`) + `记下 last['${c}'] = ${i}。窗口是 "${s.slice(left, i + 1)}"，长度 ${i - left + 1}。`, view(i, -1), facts(i));
        }
      }
      snap("完成", `走到头了。最长的无重复子串长度是 <b>${best}</b>。`, view(s.length, -1), { kind: "ok", ans: best, facts: [["最长", best]] });
    },
  }],
  points: [
    { t: "while 不是 if", body: "重复的那个字符可能不在最左边，要一直移到它被移出去为止。" },
    { t: "先收缩再加入", body: "先把窗口缩到不含 <code>ch</code>，再把 <code>ch</code> 加进集合，最后更新答案。" },
    { t: "更快的写法", body: "用字典记每个字符上次出现的下标，重复时 <code>l</code> 可以直接跳到那个下标的右边。" },
  ],
};
