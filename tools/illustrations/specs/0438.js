module.exports = {
  id: 438, name: "找到字符串中所有字母异位词", title: "找到所有字母异位词图解", level: "中等", topic: "滑动窗口",
  h1: "找到所有字母异位词，一个固定长度的窗口滑过去",
  lede: "p 的异位词长度一定和 p 一样。用一个长度固定为 len(p) 的窗口在 s 上滑动，每滑一格只有一个字符进、一个字符出，比较窗口和 p 的字母计数是否相同。",
  hints: [
    { t: "窗口长度是固定的", body: ["异位词和 <code>p</code> 的字母完全相同，所以长度也相同。", "只需要检查 <code>s</code> 里每一段长度为 <code>len(p)</code> 的子串。"] },
    { t: "怎么判断是不是异位词", body: ["比较两边每个字母出现的次数。<code>p</code> 的计数只算一次，窗口的计数随着滑动更新。"] },
    { t: "滑动时只改两个字符", body: ["窗口右移一格：右边进来的字符计数 +1，左边出去的字符计数 −1。", "不用每次重新统计整个窗口。"] },
  ],
  codes: [{ t: "标准解法：定长滑动窗口", code: `
class Solution:
    def findAnagrams(self, s: str, p: str) -> List[int]:
        m, res = len(p), []             #@init
        need, win = Counter(p), Counter()   #@init
        for r, ch in enumerate(s):
            win[ch] += 1                # 右边进 #@in
            if r >= m:
                left = s[r - m]         #@out
                win[left] -= 1          # 左边出 #@out
                if win[left] == 0:      #@out
                    del win[left]       #@out
            if win == need:             #@cmp
                res.append(r - m + 1)   #@hit
        return res                      #@done
` }, { t: "简洁写法：两个 Counter 直接比较", kind: "elegant", note: "Python 3.10 起，Counter 相等比较会把缺失的键当成 0。每次比较最多 26 个键。", code: `
class Solution:
    def findAnagrams(self, s: str, p: str) -> List[int]:
        need, win, k, res = Counter(p), Counter(), len(p), []
        for i, c in enumerate(s):
            win[c] += 1
            if i >= k:
                win[s[i - k]] -= 1          # 左边滑出窗口
            if win == need:
                res.append(i - k + 1)
        return res
` }],
  pytest: `
s = Solution()
assert s.findAnagrams("cbaebabacd", "abc") == [0, 6]
assert s.findAnagrams("abab", "ab") == [0, 1, 2]
assert s.findAnagrams("a", "ab") == []
`,
  sig: { fn: "findAnagrams", params: ["string", "string"], ret: "List<int>" },
  call: (a) => [a.s, a.p],
  cases: [["a", "ab"], ["abab", "ab"], ["aaaa", "a"], ["xyz", "zyx"], ["baa", "aa"]],
  legend: [["e", "窗口"], ["c", "是异位词的窗口"], ["d", "已经滑过"]],
  presets: [
    { label: "示例 1", args: { s: "cbaebabacd", p: "abc" }, note: 's = "cbaebabacd", p = "abc"', expect: [0, 6] },
    { label: "示例 2", args: { s: "abab", p: "ab" }, note: 's = "abab", p = "ab"', expect: [0, 1, 2] },
  ],
  build(a, snap) {
    const { s, p } = a, m = p.length, res = [], win = {}, need = {};
    for (const c of p) need[c] = (need[c] || 0) + 1;
    const fmt = (o) => Object.keys(o).sort().map((k) => `${k}: ${o[k]}`);
    const same = () => Object.keys(need).length === Object.keys(win).length && Object.keys(need).every((k) => win[k] === need[k]);
    const view = (r, hit) => [
      { t: "array", label: "s", items: [...s].map((v, i) => ({ v, cls: i <= r && i > r - m ? (hit ? "c" : "e") : i <= r - m ? "d" : "" })), ptrs: r >= 0 && r < s.length ? { "起点": Math.max(0, r - m + 1), r } : {} },
      { t: "chips", label: "p 的计数 need", items: fmt(need) },
      { t: "chips", label: "窗口的计数 win", items: fmt(win).map((v) => ({ v, cls: hit ? "k" : "" })) },
      { t: "chips", label: "结果（起始下标）", items: res.slice(), empty: "还没有" },
    ];
    snap("开始", `p = "${p}"，长度 ${m}。窗口长度固定为 ${m}，从左往右滑。`, view(-1), { at: "init" });
    for (let r = 0; r < s.length; r++) {
      win[s[r]] = (win[s[r]] || 0) + 1;
      let msg = `'${s[r]}' 从右边进入窗口。`;
      const at = ["in"];
      if (r >= m) { const c = s[r - m]; win[c]--; if (!win[c]) delete win[c]; msg += `'${c}' 从左边离开。`; at.push("out"); }
      if (r < m - 1) { snap("填充窗口", msg + `窗口还没满 ${m} 个字符。`, view(r), { at }); continue; }
      const hit = same();
      if (hit) res.push(r - m + 1);
      snap(hit ? "找到" : "比较", msg + `窗口是 "${s.slice(r - m + 1, r + 1)}"，` + (hit ? `计数和 need 完全相同，记下起点 <b>${r - m + 1}</b>。` : "计数和 need 不同。"), view(r, hit), hit ? { at: [...at, "cmp", "hit"], kind: "ok" } : { at: [...at, "cmp"] });
    }
    snap("完成", `窗口滑到头了，一共找到 <b>${res.length}</b> 个起点：[${res.join(", ")}]。`, view(s.length + m), { at: "done", kind: "ok", ans: res });
  },
  points: [
    { t: "计数减到 0 要删掉", body: "用 <code>Counter</code> 直接比较时，值为 0 的键要删掉，否则 <code>{'a': 0}</code> 和空计数不相等。" },
    { t: "起点下标", body: "窗口右端是 <code>r</code>、长度是 <code>m</code>，起点是 <code>r - m + 1</code>。" },
    { t: "复杂度", body: "每次比较最多 26 个字母，时间 O(26 · n)，空间 O(26)。" },
  ],
};
