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
            while l >= 0 and r < len(s) and s[l] == s[r]:
                l -= 1
                r += 1
            return l + 1, r - 1         # 退回最后一次成功的位置

        start = end = 0
        for i in range(len(s)):
            for l, r in (expand(i, i), expand(i, i + 1)):   # 奇数中心、偶数中心
                if r - l > end - start:
                    start, end = l, r
        return s[start:end + 1]
` }, { t: "动态规划写法", note: "dp[l][r] 表示 s[l..r] 是不是回文。按长度从短到长填表。", code: `
class Solution:
    def longestPalindrome(self, s: str) -> str:
        n = len(s)
        dp = [[False] * n for _ in range(n)]
        start, size = 0, 1
        for length in range(1, n + 1):
            for l in range(n - length + 1):
                r = l + length - 1
                if s[l] == s[r] and (length <= 2 or dp[l + 1][r - 1]):
                    dp[l][r] = True
                    if length > size:
                        start, size = l, length
        return s[start:start + size]
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
  legend: [["a", "中心"], ["e", "从这个中心扩出的回文"], ["b", "两边不相等，停在这里"], ["c", "目前最长的回文"]],
  presets: [
    { label: "示例 1", args: { s: "babad" }, note: 's = "babad"', expect: "bab" },
    { label: "示例 2", args: { s: "cbbd" }, note: 's = "cbbd"', expect: "bb" },
    { label: "更长的", args: { s: "xabacabay" }, note: 's = "xabacabay"', expect: "abacaba" },
  ],
  build(a, snap) {
    const s = a.s, n = s.length; let bs = 0, be = 0;
    const view = (cl, cr, l, r, sl, sr) => [{ t: "array", label: "s", items: [...s].map((v, t) => ({ v, cls: t === sl || t === sr ? "b" : t >= cl && t <= cr ? "a" : t >= l && t <= r ? "e" : "" })), ptrs: { l: sl >= 0 ? sl : null, r: sr < n ? sr : null } }];
    const best = () => [["最长", s.slice(bs, be + 1)]];
    snap("开始", `每个字符、每两个字符之间的缝都是一个中心，一共 ${2 * n - 1} 个。逐个试。`, [{ t: "array", label: "s", items: [...s] }], { facts: best() });
    for (let i = 0; i < n; i++) for (const even of [false, true]) {
      let l = i, r = even ? i + 1 : i;
      if (r >= n) continue;
      const cl = l, cr = r;
      if (s[l] !== s[r]) { snap("这个中心不行", `中心是 ${s[l]} 和 ${s[r]} 之间的缝。两边的字符不相等，这里没有偶数长度的回文。`, view(-1, -1, -1, -1, l, r), { kind: "warn", facts: best() }); continue; }
      while (l >= 0 && r < n && s[l] === s[r]) { l--; r++; }
      const pl = l + 1, pr = r - 1, up = pr - pl > be - bs;
      if (up) { bs = pl; be = pr; }
      const why = l < 0 || r >= n ? "再往外就出界了" : `再往外是 ${s[l]} 和 ${s[r]}，不相等`;
      snap(up ? "更新最长" : "扩展", `中心是${even ? ` ${s[cl]} 和 ${s[cr]} 之间的缝` : `字符 ${s[cl]}（下标 ${cl}）`}。向两边扩，得到 <b>"${s.slice(pl, pr + 1)}"</b>，${why}。` + (up ? "它比之前的都长，记下来。" : `没有超过当前最长的 "${s.slice(bs, be + 1)}"。`), view(cl, cr, pl, pr, l, r), { kind: up ? "ok" : "", facts: best() });
    }
    snap("完成", `所有中心都试过了，最长回文子串是 <b>"${s.slice(bs, be + 1)}"</b>。`, [{ t: "array", label: "s", items: [...s].map((v, t) => ({ v, cls: t >= bs && t <= be ? "c" : "" })) }], { kind: "ok", ans: s.slice(bs, be + 1), facts: best() });
  },
  points: [
    { t: "别漏了偶数中心", body: "只试 <code>expand(i, i)</code> 找不到 <code>bb</code> 这样偶数长度的回文。" },
    { t: "expand 返回时要退一步", body: "循环结束时 <code>l</code>、<code>r</code> 已经多走了一步，回文的范围是 <code>l + 1</code> 到 <code>r − 1</code>。" },
    { t: "复杂度", body: "2n − 1 个中心，每个最多扩 n 步，时间 O(n²)，空间 O(1)。" },
  ],
};
