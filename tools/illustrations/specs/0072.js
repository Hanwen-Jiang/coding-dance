module.exports = {
  id: 72, name: "编辑距离", title: "编辑距离图解", level: "中等", topic: "多维动态规划",
  h1: "编辑距离，看两个词的最后一个字符",
  lede: "dp[i][j] 是把 word1 的前 i 个字符变成 word2 的前 j 个字符的最少操作数。最后一个字符相同就不用动；不同就三选一：删掉 word1 的最后一个、给 word1 插入 word2 的最后一个、或者把它替换掉。",
  hints: [
    { t: "定义状态", body: ["<code>dp[i][j]</code>：<code>word1[:i]</code> 变成 <code>word2[:j]</code> 的最少操作数。", "边界：<code>dp[i][0] = i</code>（全删掉），<code>dp[0][j] = j</code>（全插入）。"] },
    { t: "最后一个字符相同", body: ["<code>word1[i-1] == word2[j-1]</code> 时，这个字符不用动，<code>dp[i][j] = dp[i-1][j-1]</code>。"] },
    { t: "最后一个字符不同", body: ["删除 <code>word1[i-1]</code>：<code>dp[i-1][j] + 1</code>。", "插入 <code>word2[j-1]</code>：<code>dp[i][j-1] + 1</code>。", "替换成 <code>word2[j-1]</code>：<code>dp[i-1][j-1] + 1</code>。三者取最小。"] },
  ],
  codes: [{ t: "标准解法：二维 DP", code: `
class Solution:
    def minDistance(self, word1: str, word2: str) -> int:
        m, n = len(word1), len(word2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(m + 1):
            dp[i][0] = i                    # 全删掉
        for j in range(n + 1):
            dp[0][j] = j                    # 全插入
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if word1[i - 1] == word2[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1]             # 最后一个字符不用动
                else:
                    dp[i][j] = 1 + min(dp[i - 1][j],        # 删除
                                       dp[i][j - 1],        # 插入
                                       dp[i - 1][j - 1])    # 替换
        return dp[m][n]
` }, { t: "简洁写法：记忆化递归", kind: "elegant", note: "有一边为空时，答案就是另一边的长度。", code: `
from functools import cache

class Solution:
    def minDistance(self, word1: str, word2: str) -> int:
        @cache
        def d(i, j):
            if not i or not j:
                return i + j
            if word1[i - 1] == word2[j - 1]:
                return d(i - 1, j - 1)
            return 1 + min(d(i - 1, j), d(i, j - 1), d(i - 1, j - 1))
        return d(len(word1), len(word2))
` }],
  pytest: `
s = Solution()
assert s.minDistance("horse", "ros") == 3
assert s.minDistance("intention", "execution") == 5
assert s.minDistance("", "abc") == 3
assert s.minDistance("abc", "") == 3
assert s.minDistance("abc", "yabd") == 2
`,
  legend: [["a", "正在算的格子"], ["e", "用到的格子"], ["c", "结果"]],
  presets: [
    { label: "示例 1", args: { w1: "horse", w2: "ros" }, note: "word1 = \"horse\", word2 = \"ros\"", expect: 3 },
    { label: "插入 + 替换", args: { w1: "abc", w2: "yabd" }, note: "word1 = \"abc\", word2 = \"yabd\"", expect: 2 },
  ],
  build(a, snap) {
    const A = a.w1, B = a.w2, m = A.length, n = B.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : null)));
    const view = (ci, cj, used, fin) => [
      { t: "array", label: "word1（行 i 对应前 i 个字符）", idxFrom: 1, items: A.split("").map((c, k) => ({ v: c, cls: k === ci - 1 ? "a" : "" })), ptrs: {} },
      { t: "array", label: "word2（列 j 对应前 j 个字符）", idxFrom: 1, items: B.split("").map((c, k) => ({ v: c, cls: k === cj - 1 ? "a" : "" })), ptrs: {} },
      { t: "grid", label: "dp[i][j]", rows: dp.map((r, i) => r.map((v, j) => ({ v: v === null ? "" : v, cls: fin && i === m && j === n ? "c" : i === ci && j === cj ? "a" : used.some(([x, y]) => x === i && y === j) ? "e" : "" }))) },
    ];
    snap("开始", `第 0 列：把 word1 的前 i 个字符全删掉，要 i 步。第 0 行：从空串插入 j 个字符，要 j 步。`, view(-1, -1, []));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      if (A[i - 1] === B[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        snap(`(${i}, ${j})`, `最后一个字符都是 '${A[i - 1]}'，不用动。dp[${i}][${j}] = dp[${i - 1}][${j - 1}] = <b>${dp[i][j]}</b>。`, view(i, j, [[i - 1, j - 1]]));
      } else {
        const d = dp[i - 1][j], ins = dp[i][j - 1], r = dp[i - 1][j - 1];
        dp[i][j] = 1 + Math.min(d, ins, r);
        const how = r <= d && r <= ins ? `替换 '${A[i - 1]}' 为 '${B[j - 1]}'` : d <= ins ? `删除 '${A[i - 1]}'` : `插入 '${B[j - 1]}'`;
        snap(`(${i}, ${j})`, `'${A[i - 1]}' ≠ '${B[j - 1]}'。删除 ${d} + 1，插入 ${ins} + 1，替换 ${r} + 1。最小的是${how}，dp = <b>${dp[i][j]}</b>。`, view(i, j, [[i - 1, j], [i, j - 1], [i - 1, j - 1]]));
      }
    }
    snap("完成", `"${A}" 变成 "${B}" 最少要 <b>${dp[m][n]}</b> 步。`, view(-1, -1, [], true), { kind: "ok", ans: dp[m][n] });
  },
  points: [
    { t: "下标错一位", body: "dp 是 (m+1)×(n+1)，dp[i][j] 比较的是 word1[i-1] 和 word2[j-1]。" },
    { t: "三个方向的含义", body: "左上是替换（或相同时不动），上面是删除，左边是插入。记住这个对应关系就不会写错。" },
    { t: "复杂度", body: "时间 O(m·n)，空间 O(m·n)，可以压成一行加一个变量存左上角。" },
  ],
};
