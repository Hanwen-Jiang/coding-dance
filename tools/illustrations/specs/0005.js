module.exports = {
  id: 5, name: "最长回文子串", title: "最长回文子串图解", level: "中等", topic: "多维动态规划",
  h1: "最长回文子串，从每个中心向两边扩",
  lede: "回文串是左右对称的，所以可以从中间往两边看：只要两边的字符相同，就能继续往外扩。把每个位置都当一次中心试一遍，记下能扩到的最长的那一段。",
  hints: [
    { t: "从中心往外看", body: ["如果 <code>s[l..r]</code> 是回文，并且 <code>s[l−1] == s[r+1]</code>，那么 <code>s[l−1..r+1]</code> 也是回文。", "所以从一个中心出发，不断比较两边的字符，能扩多远就扩多远。"] },
    { t: "中心有两种", body: ["奇数长度的回文（如 <code>aba</code>）中心是一个字符。", "偶数长度的回文（如 <code>abba</code>）中心是两个字符之间的缝。两种都要试，一共 <code>2n − 1</code> 个中心。"] },
    { t: "和动态规划的关系", body: ["动态规划的写法是 <code>dp[l][r] = (s[l] == s[r]) and dp[l+1][r−1]</code>，判断每一段是不是回文。", "中心扩展用的是同一个递推关系，只是不用存整张表，空间从 <code>O(n²)</code> 降到 <code>O(1)</code>。"] },
  ],
  codes: [{ t: "标准解法：中心扩展", code: `
class Solution:
    def longestPalindrome(self, s: str) -> str:
        def expand(l, r):
            while l >= 0 and r < len(s) and s[l] == s[r]:   #@grow,miss
                l -= 1                  #@grow
                r += 1                  #@grow
            return l + 1, r - 1         # 退回最后一次成功的位置 #@grow

        start = end = 0                 #@init
        for i in range(len(s)):
            for l, r in (expand(i, i), expand(i, i + 1)):   # 奇数中心、偶数中心 #@grow,miss
                if r - l > end - start: #@grow,update
                    start, end = l, r   #@update
        return s[start:end + 1]         #@done
` }, { t: "动态规划写法", key: "dp", note: "dp[l][r] 表示 s[l..r] 是不是回文。按长度从短到长填表。", code: `
class Solution:
    def longestPalindrome(self, s: str) -> str:
        n = len(s)                      #@init
        dp = [[False] * n for _ in range(n)]    #@init
        start, size = 0, 1              #@init
        for length in range(1, n + 1):
            for l in range(n - length + 1):
                r = l + length - 1      #@fill
                if s[l] == s[r] and (length <= 2 or dp[l + 1][r - 1]):  #@fill
                    dp[l][r] = True     #@fill
                    if length > size:   #@fill,update
                        start, size = l, length     #@update
        return s[start:start + size]    #@done
` }, { t: "简洁写法：所有中心扩一遍，取最长", kind: "elegant", note: "每个位置 i 有两个中心：(i, i) 是奇数长度，(i, i+1) 是偶数长度。", code: `
class Solution:
    def longestPalindrome(self, s: str) -> str:
        def grow(l, r):
            while l >= 0 and r < len(s) and s[l] == s[r]:
                l, r = l - 1, r + 1
            return s[l + 1:r]
        return max((grow(i, j) for i in range(len(s)) for j in (i, i + 1)), key=len)
` }],
  pytest: `
s = Solution()
assert s.longestPalindrome("babad") in ("bab", "aba")
assert s.longestPalindrome("cbbd") == "bb"
assert s.longestPalindrome("a") == "a"
assert s.longestPalindrome("ac") in ("a", "c")
def brute(t):
    best = ""
    for i in range(len(t)):
        for j in range(i, len(t)):
            if t[i:j+1] == t[i:j+1][::-1] and j - i + 1 > len(best): best = t[i:j+1]
    return best
for _ in range(300):
    t = "".join(random.choice("ab") for _ in range(random.randint(1, 12)))
    r = s.longestPalindrome(t)
    assert r == r[::-1] and r in t and len(r) == len(brute(t))
`,
  // 最长回文可能不止一个（比如 "babad" 的 "bab" 和 "aba"），只比长度
  sig: { fn: "longestPalindrome", params: ["string"], ret: "string", cmp: "length" },
  call: (a) => [a.s],
  cases: [["a"], ["ac"], ["cbbd"], ["aaaa"], ["abcba"]],
  method: "中心扩展",
  legend: [["a", "中心"], ["e", "从这个中心扩出的回文"], ["b", "两边不相等，停在这里"], ["c", "目前最长的回文"]],
  presets: [
    { label: "示例 1", args: { s: "babad" }, note: 's = "babad"', expect: "bab" },
    { label: "示例 2", args: { s: "cbbd" }, note: 's = "cbbd"', expect: "bb" },
    { label: "更长的", args: { s: "xabacabay" }, note: 's = "xabacabay"', expect: "abacaba" },
  ],
  build(a, snap) {
    const s = a.s, n = s.length; let bs = 0, be = 0;
    const view = (cl, cr, l, r, sl, sr) => [{ t: "array", label: "s", items: [...s].map((v, t) => ({ v, cls: t === sl || t === sr ? "b" : t >= cl && t <= cr ? "a" : t >= l && t <= r ? "e" : "" })), ptrs: { l: sl >= 0 ? sl : null, r: sr < n ? sr : null } }];
    snap("开始", `每个字符、每两个字符之间的缝都是一个中心，一共 ${2 * n - 1} 个。逐个试。`, [{ t: "array", label: "s", items: [...s].map((v) => ({ v })), ptrs: {} }], { at: "init", facts: [["中心数", 2 * n - 1], ["最长", s.slice(bs, be + 1)]] });
    for (let i = 0; i < n; i++) for (const even of [false, true]) {
      let l = i, r = even ? i + 1 : i;
      if (r >= n) continue;
      const cl = l, cr = r;
      if (s[l] !== s[r]) {
        snap("这个中心不行", `中心是 ${s[l]} 和 ${s[r]} 之间的缝。两边的字符不相等，这里没有偶数长度的回文。`, view(-1, -1, -1, -1, l, r), { at: "miss", kind: "warn", facts: [["尝试中心", `${s[l]}|${s[r]}`], ["最长", s.slice(bs, be + 1)]] });
        continue;
      }
      while (l >= 0 && r < n && s[l] === s[r]) { l--; r++; }
      const pl = l + 1, pr = r - 1, up = pr - pl > be - bs;
      const prevBest = s.slice(bs, be + 1);
      if (up) { bs = pl; be = pr; }
      const curBest = s.slice(bs, be + 1);
      const why = l < 0 || r >= n ? "再往外就出界了" : `再往外是 ${s[l]} 和 ${s[r]}，不相等`;
      snap(
        up ? "更新最长" : "扩展",
        `中心是${even ? ` ${s[cl]} 和 ${s[cr]} 之间的缝` : `字符 ${s[cl]}（下标 ${cl}）`}。向两边扩，得到 <b>"${s.slice(pl, pr + 1)}"</b>，${why}。` + (up ? "它比之前的都长，记下来。" : `没有超过当前最长的 "${curBest}"。`),
        view(cl, cr, pl, pr, l, r),
        {
          at: up ? ["grow", "update"] : "grow",
          kind: up ? "ok" : "",
          facts: [["当前扩出", s.slice(pl, pr + 1)], up ? ["最长", curBest, prevBest] : ["最长", curBest]],
        },
      );
    }
    snap("完成", `所有中心都试过了，最长回文子串是 <b>"${s.slice(bs, be + 1)}"</b>。`, [{ t: "array", label: "s", items: [...s].map((v, t) => ({ v, cls: t >= bs && t <= be ? "c" : "" })), ptrs: {} }], { at: "done", kind: "ok", ans: s.slice(bs, be + 1), facts: [["最长", s.slice(bs, be + 1)], ["长度", be - bs + 1]] });
  },
  alts: [{
    t: "动态规划",
    code: "dp",
    note: "dp[l][r] 表示 s[l..r] 是不是回文。按长度从短到长填表：两端相等，并且去掉两端后还是回文，这一段才是回文。",
    legend: [["a", "正在填的格子 / 这一段的两端"], ["k", "要参考的 dp[l+1][r−1]"], ["e", "是回文"], ["c", "目前最长的回文"], ["d", "用不到（l > r）"], ["x", "越过对角线：空串，当成回文"]],
    build(a, snap) {
      const s = a.s, n = s.length, dp = Array.from({ length: n }, () => Array(n).fill(null));
      let start = 0, size = 1;
      const view = (L, R, dep, feeds = []) => [
        { t: "array", label: "s", items: [...s].map((v, t) => ({ v, cls: t === L || t === R ? "a" : L >= 0 && t > L && t < R ? "e" : "" })), ptrs: { l: L >= 0 ? L : null, r: R >= 0 ? R : null } },
        // 对角线下面（l > r）是空串：长度 2 的子串去掉两端就落到这里，越过了对角线，当成回文（虚线）
        {
          t: "grid",
          label: "dp[l][r]（行是 l，列是 r；对角线下面 l > r 是空串）",
          rows: dp.map((row, i) => row.map((v, j) => {
            const isDep = dep && dep[0] === i && dep[1] === j;
            return {
              v: isDep && j < i ? "空" : j < i || v === null ? "" : v ? "✓" : "✗",
              cls: i === L && j === R ? "a" : isDep ? (j < i ? "x k" : "k") : j < i ? "d" : v && i === start && j === start + size - 1 ? "c" : v ? "e" : "",
            };
          })),
          feeds: feeds.slice(),
        },
      ];
      for (let i = 0; i < n; i++) dp[i][i] = true;
      snap("长度 1", `长度为 1 的子串都是回文，对角线先全填 ✓。目前最长的是 "${s[0]}"。`, view(-1, -1, null, []), { at: ["init", "fill"], facts: [["当前长度", 1], ["最长", s.slice(start, start + size)]] });
      for (let len = 2; len <= n; len++) for (let l = 0; l + len - 1 < n; l++) {
        const r = l + len - 1, eq = s[l] === s[r], ok = eq && (len === 2 || dp[l + 1][r - 1]);
        dp[l][r] = ok;
        const prevBest = s.slice(start, start + size);
        const up = ok && len > size;
        if (up) { start = l; size = len; }
        const curBest = s.slice(start, start + size);
        const feeds = eq ? [{ from: [l + 1, r - 1], to: [l, r], win: ok, label: len === 2 ? "空串" : ok ? "继承✓" : "继承✗" }] : [];
        const why = !eq ? `两端 '${s[l]}' 和 '${s[r]}' 不相等，不是回文。`
          : len === 2 ? `两个字符都是 '${s[l]}'。去掉两端后是空串：dp[${l + 1}][${r - 1}] 的 l > r，落在对角线下面（虚线），这个格子没有填过。空串算回文，所以代码里 length ≤ 2 时直接不看它，这一段是回文。`
          : `两端都是 '${s[l]}'，再看去掉两端的 dp[${l + 1}][${r - 1}]：${dp[l + 1][r - 1] ? "是回文，所以这一段也是" : "不是回文，所以这一段也不是"}。`;
        snap(
          up ? "更新最长" : `长度 ${len}`,
          `s[${l}..${r}] = "${s.slice(l, r + 1)}"：${why}` + (up ? "比之前的都长，记下来。" : ""),
          view(l, r, eq ? [l + 1, r - 1] : null, feeds),
          {
            at: up ? ["fill", "update"] : "fill",
            kind: up ? "ok" : "",
            facts: [
              ["子串", `"${s.slice(l, r + 1)}"`],
              ["两端比较", eq ? `'${s[l]}' = '${s[r]}'` : `'${s[l]}' ≠ '${s[r]}'`],
              ["dp[l][r]", ok ? "✓" : "✗"],
              up ? ["最长", curBest, prevBest] : ["最长", curBest],
            ],
          },
        );
      }
      snap("完成", `表填完了，最长回文子串是 <b>"${s.slice(start, start + size)}"</b>。`, view(-1, -1, null, []), { at: "done", kind: "ok", ans: s.slice(start, start + size), facts: [["最长", s.slice(start, start + size)], ["长度", size]] });
    },
  }],
  points: [
    { t: "别漏了偶数中心", body: "只试 <code>expand(i, i)</code> 找不到 <code>bb</code> 这样偶数长度的回文。" },
    { t: "expand 返回时要退一步", body: "循环结束时 <code>l</code>、<code>r</code> 已经多走了一步，回文的范围是 <code>l + 1</code> 到 <code>r − 1</code>。" },
    { t: "复杂度", body: "2n − 1 个中心，每个最多扩 n 步，时间 O(n²)，空间 O(1)。" },
  ],
};
