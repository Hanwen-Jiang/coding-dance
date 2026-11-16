module.exports = {
  id: 1143, name: "最长公共子序列", title: "最长公共子序列图解", level: "中等", topic: "多维动态规划",
  h1: "最长公共子序列，最后一个字符配不配得上",
  lede: "dp[i][j] 是 text1 前 i 个字符和 text2 前 j 个字符的最长公共子序列长度。两边最后一个字符相同，就一起算进去；不同，就扔掉其中一边的最后一个字符，取较大的结果。",
  hints: [
    { t: "定义状态", body: ["<code>dp[i][j]</code>：<code>text1[:i]</code> 和 <code>text2[:j]</code> 的 LCS 长度。有一边为空时是 0。"] },
    { t: "最后一个字符相同", body: ["<code>text1[i-1] == text2[j-1]</code>，这个字符一定可以放进公共子序列的末尾：<code>dp[i][j] = dp[i-1][j-1] + 1</code>。"] },
    { t: "最后一个字符不同", body: ["两个字符至少有一个不在 LCS 的末尾，扔掉它：<code>dp[i][j] = max(dp[i-1][j], dp[i][j-1])</code>。"] },
  ],
  codes: [{ t: "标准解法：二维 DP", code: `
class Solution:
    def longestCommonSubsequence(self, text1: str, text2: str) -> int:
        m, n = len(text1), len(text2)       #@init
        dp = [[0] * (n + 1) for _ in range(m + 1)]  #@init
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if text1[i - 1] == text2[j - 1]:    #@same,diff
                    dp[i][j] = dp[i - 1][j - 1] + 1             # 一起算进去 #@same
                else:                               #@diff
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])  # 扔掉一边的最后一个 #@diff
        return dp[m][n]                     #@done
` }, { t: "简洁写法：两行滚动（空间压缩）", key: "roll", kind: "elegant", note: "只留两行：prev 是上一行，cur 是正在算的这一行。prev[j] 是左上，prev[j+1] 是上面，cur[j] 是左边。空间 O(n)。", code: `
class Solution:
    def longestCommonSubsequence(self, text1: str, text2: str) -> int:
        prev = [0] * (len(text2) + 1)   # 第 0 行：text1 取空串，全是 0 #@init
        for a in text1:                 #@row
            cur = [0]                   # 这一行的第 0 列：text2 取空串，是 0 #@row
            for j, b in enumerate(text2):
                cur.append(prev[j] + 1 if a == b else max(prev[j + 1], cur[j]))  # 左上 prev[j]，上面 prev[j+1]，左边 cur[j] #@same,diff
            prev = cur                  # 这一行算完，成了下一行的「上一行」 #@next
        return prev[-1]                 #@done
` }],
  sig: { fn: "longestCommonSubsequence", params: ["string", "string"], ret: "int" },
  call: (a) => [a.t1, a.t2],
  cases: [["a", "a"], ["a", "b"], ["abc", "abc"], ["bsbininm", "jmjkbkjkv"]],
  pytest: `
s = Solution()
assert s.longestCommonSubsequence("abcde", "ace") == 3
assert s.longestCommonSubsequence("abc", "abc") == 3
assert s.longestCommonSubsequence("abc", "def") == 0
assert s.longestCommonSubsequence("bsbininm", "jmjkbkjkv") == 1
assert s.longestCommonSubsequence("oxcpqrsvwf", "shmtulqrypy") == 2
`,
  legend: [["a", "正在算的格子"], ["e", "用到的格子"], ["x", "边界：有一边是空串"], ["c", "结果"]],
  presets: [
    { label: "示例 1", args: { t1: "abcde", t2: "ace" }, note: "text1 = \"abcde\", text2 = \"ace\"", expect: 3 },
    { label: "没有公共", args: { t1: "abc", t2: "def" }, note: "text1 = \"abc\", text2 = \"def\"", expect: 0 },
  ],
  build(a, snap) {
    const A = a.t1, B = a.t2, m = A.length, n = B.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 || j === 0 ? 0 : null)));
    const view = (ci, cj, used, fin) => [
      { t: "array", label: "text1（行 i 对应前 i 个字符）", idxFrom: 1, items: A.split("").map((c, k) => ({ v: c, cls: k === ci - 1 ? "a" : "" })), ptrs: {} },
      { t: "array", label: "text2（列 j 对应前 j 个字符）", idxFrom: 1, items: B.split("").map((c, k) => ({ v: c, cls: k === cj - 1 ? "a" : "" })), ptrs: {} },
      // 第 0 行、第 0 列是边界（虚线）：多开这一行一列，dp[i-1][j-1] 在 i = 1 或 j = 1 时才不会越界
      { t: "grid", label: "dp[i][j]（虚线是边界：取前 0 个字符，也就是空串）", rows: dp.map((r, i) => r.map((v, j) => {
        const u = used.some(([x, y]) => x === i && y === j), edge = i === 0 || j === 0;
        return { v: v === null ? "" : v, cls: fin && i === m && j === n ? "c" : i === ci && j === cj ? "a" : edge ? (u ? "x e" : "x") : u ? "e" : "" };
      })) },
    ];
    snap("边界", "dp 比两个字符串各多开一行一列。第 0 行是 text1 取空串、第 0 列是 text2 取空串：空串和谁的公共子序列都是 <b>0</b>。<br>为什么要这一圈：算 dp[1][j] 要用 dp[0][j−1]、dp[0][j]，如果不多开，下标就是 -1，越界了。多开一圈、填上 0，转移公式在边上也能直接用。", view(-1, -1, []), { at: "init" });
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const edge = i === 1 || j === 1 ? `（用到了边界上的格子：空串，值是 0）` : "";
      if (A[i - 1] === B[j - 1]) { dp[i][j] = dp[i - 1][j - 1] + 1; snap(`(${i}, ${j})`, `最后一个字符都是 '${A[i - 1]}'，一起算进去：dp[${i - 1}][${j - 1}] + 1 = <b>${dp[i][j]}</b>。` + (i === 1 || j === 1 ? edge : ""), view(i, j, [[i - 1, j - 1]]), { at: "same" }); }
      else { dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]); snap(`(${i}, ${j})`, `'${A[i - 1]}' ≠ '${B[j - 1]}'，扔掉一边：上面 ${dp[i - 1][j]}，左边 ${dp[i][j - 1]}，取大的 <b>${dp[i][j]}</b>。` + (i === 1 || j === 1 ? edge : ""), view(i, j, [[i - 1, j], [i, j - 1]]), { at: "diff" }); }
    }
    snap("完成", `最长公共子序列的长度是 <b>${dp[m][n]}</b>。`, view(-1, -1, [], true), { at: "done", kind: "ok", ans: dp[m][n] });
  },
  alts: [{
    t: "两行滚动（空间压缩）",
    code: "roll",
    note: "算第 i 行只用到第 i − 1 行，所以只留两行：prev 是上一行，cur 是这一行。cur[j + 1] 看三个格子：左上 prev[j]、上面 prev[j + 1]、左边 cur[j]。这一行算完，cur 就成了下一行的 prev。",
    legend: [["a", "正在算的格子 / 正在比的两个字符"], ["g", "prev：上一行"], ["k", "cur：这一行已经算好的"], ["e", "这一步用到的格子"], ["x", "边界：空串，值是 0"]],
    build(a, snap) {
      const A = a.t1, B = a.t2, m = A.length, n = B.length;
      let prev = Array(n + 1).fill(0), cur = null, row = 0;
      const view = (i, j, used) => [
        { t: "array", label: "text1", idxFrom: 1, items: [...A].map((c, k) => ({ v: c, cls: k === i - 1 ? "a" : "" })) },
        { t: "array", label: "text2", idxFrom: 1, items: [...B].map((c, k) => ({ v: c, cls: k === j ? "a" : "" })) },
        { t: "array", label: `prev：第 ${row} 行` + (row === 0 ? "（text1 取空串，全是 0）" : ""), items: prev.map((v, k) => ({ v, cls: used.some(([w, y]) => w === "p" && y === k) ? (row === 0 || k === 0 ? "x e" : "e") : row === 0 || k === 0 ? "x" : "g" })) },
        cur ? { t: "array", label: `cur：第 ${row + 1} 行（算到哪填到哪）`, items: Array.from({ length: n + 1 }, (_, k) => ({ v: k < cur.length ? cur[k] : "", cls: k === j + 1 ? "a" : used.some(([w, y]) => w === "c" && y === k) ? (k === 0 ? "x e" : "e") : k === 0 ? "x" : k < cur.length ? "k" : "" })) } : { t: "note", label: "cur", html: "还没开始" },
      ];
      snap("开始", "只留两行。prev 一开始是第 0 行：text1 取空串，和谁的公共子序列都是 0（边界，虚线）。", view(-1, -2, []), { at: "init" });
      for (let i = 1; i <= m; i++) {
        cur = [0];
        snap(`第 ${i} 行`, `开始算第 ${i} 行（text1 的第 ${i} 个字符 '${A[i - 1]}'）。cur 先放一个 0：第 0 列是 text2 取空串，边界。`, view(i, -2, []), { at: "row" });
        for (let j = 0; j < n; j++) {
          if (A[i - 1] === B[j]) {
            cur.push(prev[j] + 1);
            snap(`(${i}, ${j + 1})`, `'${A[i - 1]}' = '${B[j]}'：取左上 prev[${j}] = ${prev[j]}，加 1，cur[${j + 1}] = <b>${cur[j + 1]}</b>。`, view(i, j, [["p", j]]), { at: "same" });
          } else {
            cur.push(Math.max(prev[j + 1], cur[j]));
            snap(`(${i}, ${j + 1})`, `'${A[i - 1]}' ≠ '${B[j]}'：上面 prev[${j + 1}] = ${prev[j + 1]}，左边 cur[${j}] = ${cur[j]}，取大的，cur[${j + 1}] = <b>${cur[j + 1]}</b>。`, view(i, j, [["p", j + 1], ["c", j]]), { at: "diff" });
          }
        }
        prev = cur; cur = null; row = i;
        snap("换行", `第 ${i} 行算完了。prev = cur：它成了下一行的「上一行」，更早的行不用再留着。`, view(-1, -2, []), { at: "next" });
      }
      snap("完成", `prev 的最后一个数就是答案：<b>${prev[n]}</b>。整个过程只留了两行，空间 O(n)。`, view(-1, -2, []), { at: "done", kind: "ok", ans: prev[n] });
    },
  }],
  points: [
    { t: "子序列不是子串", body: "可以不连续，所以字符不同时不是归零，而是从上面或左边继承。" },
    { t: "和编辑距离对照着记", body: "相同时都走左上；不同时 LCS 取 max 不加一，编辑距离取三者 min 再加一。" },
    { t: "复杂度", body: "时间 O(m·n)，一行滚动时空间 O(n)。" },
  ],
};
