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
  legend: [["e", "窗口"], ["a", "新进入窗口"], ["b", "刚滑出窗口"], ["c", "是异位词的窗口"], ["d", "已经滑过"]],
  presets: [
    { label: "示例 1", args: { s: "cbaebabacd", p: "abc" }, note: 's = "cbaebabacd", p = "abc"', expect: [0, 6] },
    { label: "示例 2", args: { s: "abab", p: "ab" }, note: 's = "abab", p = "ab"', expect: [0, 1, 2] },
  ],
  build(a, snap) {
    const { s, p } = a, m = p.length, res = [], win = {}, need = {};
    for (const c of p) need[c] = (need[c] || 0) + 1;
    const needKeys = Object.keys(need).length;
    const fmtNeed = Object.keys(need).sort().map((k) => `${k}: ${need[k]}`);
    const fmtWin = (hit) => Object.keys(win).sort().map((k) => ({ v: `${k}: ${win[k]}`, cls: hit ? "c" : need[k] === win[k] ? "k" : "w" }));
    const matchedCount = () => Object.keys(need).filter((k) => (win[k] || 0) === need[k]).length;
    const same = () => Object.keys(need).length === Object.keys(win).length && Object.keys(need).every((k) => win[k] === need[k]);
    const view = (r, hit, slide) => [
      {
        t: "array",
        label: "s",
        items: [...s].map((v, i) => ({
          v,
          cls: slide && i === r ? "a"
            : slide && r >= m && i === r - m ? "b"
              : i <= r && i > r - m ? (hit ? "c" : "e")
                : i <= r - m ? "d" : "",
        })),
        ptrs: r >= 0 && r < s.length ? { "起点": Math.max(0, r - m + 1), r } : {},
      },
      { t: "chips", label: "p 的计数 need", items: fmtNeed },
      { t: "chips", label: "窗口的计数 win", items: fmtWin(hit) },
      { t: "chips", label: "结果（起始下标）", items: res.slice(), empty: "还没有" },
    ];
    snap("开始", `p = "${p}"，长度 ${m}。窗口长度固定为 ${m}，从左往右滑。`, view(-1, false, false), {
      at: "init",
      facts: [["窗口", "空"], ["窗口长度", `0/${m}`], ["匹配字母", `0/${needKeys}`], ["已找到", 0]],
    });
    for (let r = 0; r < s.length; r++) {
      const prevWin = s.slice(Math.max(0, r - m), r) || "空";
      const prevLen = Math.min(r, m);
      const prevMatched = matchedCount();
      win[s[r]] = (win[s[r]] || 0) + 1;
      let outChar = null;
      if (r >= m) {
        outChar = s[r - m];
        win[outChar]--;
        if (!win[outChar]) delete win[outChar];
      }
      const curStart = Math.max(0, r - m + 1), curWin = s.slice(curStart, r + 1), curLen = curWin.length, curMatched = matchedCount();
      if (r < m - 1) {
        snap("填充窗口", `'${s[r]}' 从右边进入窗口，窗口还没满 ${m} 个字符。`, view(r, false, true), {
          at: "in",
          facts: [["窗口", curWin, prevWin], ["窗口长度", `${curLen}/${m}`, `${prevLen}/${m}`], ["匹配字母", `${curMatched}/${needKeys}`, `${prevMatched}/${needKeys}`], ["已找到", res.length]],
        });
        continue;
      }
      if (r >= m) {
        snap("滑动窗口", `'${s[r]}' 从右边进入，'${outChar}' 从左边滑出，窗口变成 "${curWin}"。`, view(r, false, true), {
          at: ["in", "out"],
          facts: [["窗口", curWin, prevWin], ["窗口长度", `${curLen}/${m}`], ["匹配字母", `${curMatched}/${needKeys}`, `${prevMatched}/${needKeys}`], ["已找到", res.length]],
        });
      } else {
        snap("右端进入", `'${s[r]}' 从右边进入窗口，窗口长度刚好达到 ${m}（"${curWin}"）。`, view(r, false, true), {
          at: "in",
          facts: [["窗口", curWin, prevWin], ["窗口长度", `${curLen}/${m}`, `${prevLen}/${m}`], ["匹配字母", `${curMatched}/${needKeys}`, `${prevMatched}/${needKeys}`], ["已找到", res.length]],
        });
      }
      const hit = same(), oldResLen = res.length;
      if (hit) res.push(curStart);
      snap(
        hit ? "找到异位词" : "比较计数",
        `比较窗口 "${curWin}" 与 need：` + (hit ? `计数完全相同，记下起点 <b>${curStart}</b>。` : `匹配 ${curMatched}/${needKeys} 个字母，还不是异位词。`),
        view(r, hit, false),
        hit
          ? { at: ["cmp", "hit"], kind: "ok", facts: [["窗口", curWin], ["窗口长度", `${curLen}/${m}`], ["匹配字母", `${curMatched}/${needKeys}`], ["已找到", res.length, oldResLen]] }
          : { at: "cmp", facts: [["窗口", curWin], ["窗口长度", `${curLen}/${m}`], ["匹配字母", `${curMatched}/${needKeys}`], ["已找到", res.length]] },
      );
    }
    snap("完成", `窗口滑到头了，一共找到 <b>${res.length}</b> 个起点：[${res.join(", ")}]。`, view(s.length + m, false, false), {
      at: "done",
      kind: "ok",
      ans: res.slice(),
      facts: [["已找到", res.length]],
    });
  },
  points: [
    { t: "计数减到 0 要删掉", body: "用 <code>Counter</code> 直接比较时，值为 0 的键要删掉，否则 <code>{'a': 0}</code> 和空计数不相等。" },
    { t: "起点下标", body: "窗口右端是 <code>r</code>、长度是 <code>m</code>，起点是 <code>r - m + 1</code>。" },
    { t: "复杂度", body: "每次比较最多 26 个字母，时间 O(26 · n)，空间 O(26)。" },
  ],
};
