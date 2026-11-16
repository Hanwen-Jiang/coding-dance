module.exports = {
  id: 139, name: "单词拆分", title: "单词拆分图解", level: "中等", topic: "动态规划",
  h1: "单词拆分，前缀能拆，再接一个词",
  lede: "s 的前 i 个字符能拆，等价于存在一个位置 j：前 j 个字符能拆，并且 s[j:i] 正好是字典里的一个词。从短到长算出每个前缀能不能拆，最后看整个串。",
  hints: [
    { t: "定义状态", body: ["<code>dp[i]</code>：<code>s</code> 的前 <code>i</code> 个字符 <code>s[0:i]</code> 能不能拆成字典里的词。", "<code>dp[0] = True</code>，空串什么都不用拆。"] },
    { t: "枚举最后一个词", body: ["前 <code>i</code> 个字符的最后一个词是 <code>s[j:i]</code>。只要有一个 <code>j</code> 满足 <code>dp[j]</code> 为真且 <code>s[j:i]</code> 在字典里，<code>dp[i]</code> 就为真。"] },
    { t: "查字典要快", body: ["把 <code>wordDict</code> 放进集合，查一次 O(1)（不算切片的开销）。", "也可以只枚举字典里的词作为最后一个词，词少时更快。"] },
  ],
  codes: [{ t: "标准解法：动态规划", code: `
class Solution:
    def wordBreak(self, s: str, wordDict: List[str]) -> bool:
        words = set(wordDict)               #@init
        dp = [True] + [False] * len(s)      # dp[i]：前 i 个字符能不能拆 #@init
        for i in range(1, len(s) + 1):      #@try
            for j in range(i):              #@try
                if dp[j] and s[j:i] in words:   # 前 j 个能拆，s[j:i] 又是一个词 #@try
                    dp[i] = True            #@hit
                    break                   #@hit
        return dp[-1]                       #@done
` }, { t: "简洁写法：记忆化递归", kind: "elegant", note: "ok(i) 表示 s[i:] 能不能拆：试每个以位置 i 开头的词，剩下的部分递归。", code: `
from functools import cache

class Solution:
    def wordBreak(self, s: str, wordDict: List[str]) -> bool:
        @cache
        def ok(i):
            return i == len(s) or any(s.startswith(w, i) and ok(i + len(w)) for w in wordDict)
        return ok(0)
` }],
  sig: { fn: "wordBreak", params: ["string", "List<string>"], ret: "bool" },
  call: (a) => [a.s, a.words],
  cases: [["a", ["b"]], ["a", ["a"]], ["aaaaaaab", ["a", "aa", "aaa"]], ["cars", ["car", "ca", "rs"]]],
  pytest: `
s = Solution()
assert s.wordBreak("leetcode", ["leet","code"]) is True
assert s.wordBreak("applepenapple", ["apple","pen"]) is True
assert s.wordBreak("catsandog", ["cats","dog","sand","and","cat"]) is False
assert s.wordBreak("a", ["b"]) is False
assert s.wordBreak("aaaaaaaaaaaaaaaaaaaaaaaaaaaaab", ["a","aa","aaa","aaaa"]) is False
`,
  legend: [["e", "能拆的前缀"], ["a", "最后一个词 s[j:i]"], ["c", "dp 为真"]],
  presets: [
    { label: "示例 1", args: { s: "leetcode", words: ["leet", "code"] }, note: "s = \"leetcode\", wordDict = [\"leet\",\"code\"]", expect: true },
    { label: "示例 3", args: { s: "catsandog", words: ["cats", "dog", "sand", "and", "cat"] }, note: "s = \"catsandog\", wordDict = [\"cats\",\"dog\",\"sand\",\"and\",\"cat\"]", expect: false },
  ],
  build(a, snap) {
    const s = a.s, W = new Set(a.words), n = s.length, dp = Array(n + 1).fill(false); dp[0] = true;
    const view = (i, j) => [
      { t: "array", label: "s", items: s.split("").map((c, k) => ({ v: c, cls: j >= 0 && k >= j && k < i ? "a" : j >= 0 && k < j ? "e" : "" })), ptrs: {} },
      { t: "array", label: "dp[i]：前 i 个字符能不能拆", items: dp.map((v, k) => ({ v: v ? "✓" : "✗", cls: k === i ? (v ? "c" : "w") : v ? "k" : "d" })), ptrs: { i: i >= 0 ? i : null } },
    ];
    snap("开始", `字典是 {${a.words.join(", ")}}。dp[0] = ✓：空串不用拆。`, view(-1, -1), { at: "init" });
    for (let i = 1; i <= n; i++) {
      let hit = -1;
      for (let j = 0; j < i; j++) if (dp[j] && W.has(s.slice(j, i))) { hit = j; break; }
      dp[i] = hit >= 0;
      if (hit >= 0) snap(`dp[${i}]`, `前 ${hit} 个字符能拆（dp[${hit}] = ✓），"${s.slice(hit, i)}" 又在字典里。所以 "${s.slice(0, i)}" 能拆，dp[${i}] = <b>✓</b>。`, view(i, hit), { at: ["try", "hit"] });
      else snap(`dp[${i}]`, `"${s.slice(0, i)}" 找不到能拆的切法：所有 dp[j] = ✓ 的 j，s[j:${i}] 都不在字典里。dp[${i}] = ✗。`, view(i, -1), { at: "try" });
    }
    snap("完成", `dp[${n}] = ${dp[n] ? "✓" : "✗"}，返回 <b>${dp[n]}</b>。`, view(n, -1), { at: "done", kind: dp[n] ? "ok" : "warn", ans: dp[n] });
  },
  points: [
    { t: "dp 多开一位", body: "dp 长度是 len(s) + 1，dp[i] 对应前 i 个字符，dp[0] 是空串。" },
    { t: "找到一个就 break", body: "只要有一种切法就够了，不用继续找。" },
    { t: "复杂度", body: "两层循环 O(n²)，每次切片和哈希 O(n)，总共 O(n³)。n ≤ 300，完全够用。" },
  ],
};
