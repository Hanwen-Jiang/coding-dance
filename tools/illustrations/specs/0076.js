module.exports = {
  id: 76, name: "最小覆盖子串", title: "最小覆盖子串图解", level: "困难", topic: "子串",
  h1: "最小覆盖子串，右边扩到够，左边缩到刚好",
  lede: "右指针不断扩张，直到窗口包含了 t 的所有字符。然后左指针尽量收缩，缩到再缩就不够为止，这时的窗口就是一个候选答案。重复这个过程，取最短的。",
  hints: [
    { t: "窗口什么时候算合格", body: ["窗口里每种字符的数量都不少于 <code>t</code> 里的数量，就算覆盖了 <code>t</code>。", "用 <code>need</code> 记录每种字符<strong>还差几个</strong>。负数表示窗口里多出来了。"] },
    { t: "怎么快速知道合格了", body: ["不用每次检查整个 <code>need</code>。再用一个数 <code>missing</code> 记录总共还差几个字符，减到 0 就是合格。", "只有 <code>need[ch] &gt; 0</code> 时进来的字符才是真正需要的，这时 <code>missing</code> 才减 1。"] },
    { t: "合格之后", body: ["窗口合格时，尝试从左边收缩：每移出一个字符，<code>need</code> 加 1；如果加完后大于 0，说明又缺了，<code>missing</code> 加 1，停止收缩。", "每次收缩前，用当前窗口更新最短答案。"] },
  ],
  codes: [{ t: "标准解法：滑动窗口 + 欠缺计数", code: `
class Solution:
    def minWindow(self, s: str, t: str) -> str:
        need = Counter(t)               # 每种字符还差几个 #@init
        missing = len(t)                # 一共还差几个 #@init
        l = start = 0                   #@init
        size = float("inf")             #@init
        for r, ch in enumerate(s):      #@grow
            if need[ch] > 0:            #@grow
                missing -= 1            #@grow
            need[ch] -= 1               #@grow
            while missing == 0:         # 窗口合格，尝试收缩 #@shrink
                if r - l + 1 < size:    #@shrink
                    start, size = l, r - l + 1  #@shrink
                need[s[l]] += 1         #@shrink
                if need[s[l]] > 0:      #@shrink
                    missing += 1        #@broke
                l += 1                  #@shrink
        return "" if size == float("inf") else s[start:start + size]  #@done
` }, { t: "简洁写法：Counter 记欠账", kind: "elegant", note: "need[c] 是窗口还欠多少个 c，可以是负数（多了）。窗口合法后，先把左边多余的扔掉得到最短，再扔掉一个必需的，让窗口重新变得不合法。", code: `
class Solution:
    def minWindow(self, s: str, t: str) -> str:
        need, missing = Counter(t), len(t)
        best, left = (0, float("inf")), 0
        for right, c in enumerate(s, 1):        # 窗口是 s[left:right]
            missing -= need[c] > 0
            need[c] -= 1
            if not missing:
                while need[s[left]] < 0:        # 左边多余的字符
                    need[s[left]] += 1
                    left += 1
                if right - left < best[1] - best[0]:
                    best = (left, right)
                need[s[left]] += 1              # 扔掉一个必需的
                missing += 1
                left += 1
        return "" if best[1] == float("inf") else s[best[0]:best[1]]
` }],
  sig: { fn: "minWindow", params: ["string", "string"], ret: "string" },
  call: (a) => [a.s, a.t],
  cases: [["a", "a"], ["a", "aa"], ["aa", "aa"], ["ab", "b"], ["bba", "ab"], ["cabwefgewcwaefgcf", "cae"]],
  pytest: `
s = Solution()
assert s.minWindow("ADOBECODEBANC", "ABC") == "BANC"
assert s.minWindow("a", "a") == "a"
assert s.minWindow("a", "aa") == ""
assert s.minWindow("aaflslflsldkalskaaa", "aaa") == "aaa"
`,
  legend: [["e", "窗口"], ["a", "刚进来"], ["b", "刚移出"], ["d", "已滑过"], ["c", "目前最短的合格窗口"]],
  presets: [
    { label: "示例 1", args: { s: "ADOBECODEBANC", t: "ABC" }, note: 's = "ADOBECODEBANC", t = "ABC"', expect: "BANC" },
    { label: "有重复字符", args: { s: "abaacbab", t: "aab" }, note: 's = "abaacbab", t = "aab"', expect: "aba" },
  ],
  build(a, snap) {
    const { s, t } = a, need = {}; let missing = t.length, l = 0, start = -1, size = Infinity;
    for (const c of t) need[c] = (need[c] || 0) + 1;
    const keys = [...new Set(t)];
    const bestStr = () => (size === Infinity ? "无" : s.slice(start, start + size));
    const view = (r, out, final, activeChar = "", broke = false) => [
      {
        t: "array",
        label: "s",
        items: [...s].map((v, i) => ({
          v,
          cls: final
            ? (i >= start && i < start + size ? "c" : "")
            : i === out ? "b"
            : i === r ? "a"
            : i >= l && i <= r ? "e"
            : i < l ? "d"
            : "",
        })),
        ptrs: final ? {} : { l: l < s.length ? l : null, r: r >= 0 && r < s.length ? r : null },
      },
      {
        t: "chips",
        label: "need（t 里的字符还差几个，负数是多出来的）",
        items: keys.map((c) => ({
          v: `${c}: ${need[c]}`,
          cls: c === activeChar ? (broke ? "b" : "a") : need[c] > 0 ? "w" : "k",
        })),
      },
    ];
    let prevWin = "空", prevMiss = missing, prevBest = "无";
    const emit = (phase, msg, views, curWin, o = {}) => {
      const curBest = bestStr();
      const facts = o.facts || [
        curWin !== prevWin ? ["窗口", curWin, prevWin] : ["窗口", curWin],
        missing !== prevMiss ? ["还差", missing, prevMiss] : ["还差", missing],
        curBest !== prevBest ? ["最短", curBest, prevBest] : ["最短", curBest],
      ];
      prevWin = curWin; prevMiss = missing; prevBest = curBest;
      snap(phase, msg, views, { ...o, facts });
    };
    emit("开始", `t = "${t}"，一共需要 ${missing} 个字符。r 向右扩张，直到一个都不差。`, view(-1, -1, false), "空", {
      at: "init",
      facts: [["窗口", "空"], ["还差", missing], ["最短", "无"]],
    });
    for (let r = 0; r < s.length; r++) {
      const ch = s[r], useful = (need[ch] || 0) > 0;
      if (useful) missing--;
      need[ch] = (need[ch] || 0) - 1;
      const curWin = s.slice(l, r + 1) || "空";
      emit(
        "扩张",
        `'${ch}' 进入窗口。` + (useful ? `它正是需要的，还差 ${missing} 个。` : keys.includes(ch) ? "这种字符已经够了，算多出来的。" : "t 里没有它，不影响。") + (missing === 0 ? "窗口<b>合格</b>了，开始收缩左边。" : ""),
        view(r, -1, false, ch, false),
        curWin,
        { at: "grow" },
      );
      while (missing === 0) {
        const winLen = r - l + 1, validWin = s.slice(l, r + 1);
        const improved = winLen < size;
        if (improved) { start = l; size = winLen; }
        const outIdx = l, c = s[l];
        need[c]++;
        const broke = need[c] > 0;
        if (broke) missing++;
        l++;
        const afterWin = s.slice(l, r + 1) || "空";
        emit(
          broke ? "收缩到头" : "收缩",
          `当前窗口 "${validWin}" 合格，长度 ${winLen}` + (improved ? "，是目前最短的" : "") + `。移出左边的 '${c}'，` + (broke ? `这下 '${c}' 不够了，窗口不再合格，继续扩张右边。` : "窗口仍然合格，继续收缩。"),
          view(r, outIdx, false, c, broke),
          afterWin,
          { at: broke ? ["shrink", "broke"] : "shrink", kind: broke ? "warn" : "" },
        );
      }
    }
    const ans = size === Infinity ? "" : s.slice(start, start + size);
    snap("完成", `r 走到头了。最短的覆盖子串是 <b>"${ans}"</b>。`, view(-1, -1, true), {
      at: "done",
      kind: "ok",
      ans,
      facts: [["还差", missing], ["最短", ans || "无"]],
    });
  },
  points: [
    { t: "need 可以是负数", body: "负数表示窗口里这种字符比需要的多。只有从 0 变成正数时，窗口才真的缺了。" },
    { t: "先记录再收缩", body: "在 <code>while</code> 里先用当前窗口更新答案，再移出左边的字符。" },
    { t: "复杂度", body: "l 和 r 都只往右走，各走 n 步，时间 O(n + m)。" },
  ],
};
