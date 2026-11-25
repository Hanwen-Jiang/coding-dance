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
        m, n = len(word1), len(word2)   #@init
        dp = [[0] * (n + 1) for _ in range(m + 1)]  #@init
        for i in range(m + 1):          #@init
            dp[i][0] = i                    # 全删掉 #@init
        for j in range(n + 1):          #@init
            dp[0][j] = j                    # 全插入 #@init
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if word1[i - 1] == word2[j - 1]:    #@same,diff
                    dp[i][j] = dp[i - 1][j - 1]             # 最后一个字符不用动 #@same
                else:                               #@diff
                    dp[i][j] = 1 + min(dp[i - 1][j],        # 删除 #@diff
                                       dp[i][j - 1],        # 插入 #@diff
                                       dp[i - 1][j - 1])    # 替换 #@diff
        return dp[m][n]                 #@done
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
` }, { t: "进阶：空间压缩成一行", key: "roll", note: "只留一行 dp。更新前的 dp[j] 是上面，dp[j-1] 是左边；左上角在更新 dp[j-1] 时被覆盖了，所以用一个变量 leftup 提前存下来。空间 O(n)。", code: `
class Solution:
    def minDistance(self, word1: str, word2: str) -> int:
        m, n = len(word1), len(word2)
        dp = list(range(n + 1))             # 第 0 行：空串变成 word2[:j] 要插入 j 次 #@init
        for i in range(1, m + 1):
            leftup, dp[0] = dp[0], i        # 先存下左上角；第 0 列是 i（删光） #@row
            for j in range(1, n + 1):
                up = dp[j]                  # 还没更新，是上一行的值 #@saveUp
                if word1[i - 1] == word2[j - 1]:    #@same,diff
                    dp[j] = leftup          # 最后一个字符相同，不用动 #@same
                else:
                    dp[j] = 1 + min(up, dp[j - 1], leftup)  # 删除、插入、替换 #@diff
                leftup = up                 # 下一格的左上角，就是这一格的上面 #@saveLu
        return dp[n]                        #@done
` }],
  sig: { fn: "minDistance", params: ["string", "string"], ret: "int" },
  call: (a) => [a.w1, a.w2],
  cases: [["", ""], ["", "abc"], ["abc", ""], ["intention", "execution"]],
  pytest: `
s = Solution()
assert s.minDistance("horse", "ros") == 3
assert s.minDistance("intention", "execution") == 5
assert s.minDistance("", "abc") == 3
assert s.minDistance("abc", "") == 3
assert s.minDistance("abc", "yabd") == 2
`,
  legend: [["a", "正在算的格子"], ["e", "来源格子"], ["x", "边界：有一边是空串"], ["c", "结果"]],
  presets: [
    { label: "示例 1", args: { w1: "horse", w2: "ros" }, note: "word1 = \"horse\", word2 = \"ros\"", expect: 3 },
    { label: "插入 + 替换", args: { w1: "abc", w2: "yabd" }, note: "word1 = \"abc\", word2 = \"yabd\"", expect: 2 },
  ],
  build(a, snap) {
    const A = a.w1, B = a.w2, m = A.length, n = B.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : null)));
    const view = (ci, cj, used, fin, feeds = []) => [
      { t: "array", label: "word1（行 i 对应前 i 个字符）", idxFrom: 1, items: A.split("").map((c, k) => ({ v: c, cls: k === ci - 1 ? "a" : "" })), ptrs: {} },
      { t: "array", label: "word2（列 j 对应前 j 个字符）", idxFrom: 1, items: B.split("").map((c, k) => ({ v: c, cls: k === cj - 1 ? "a" : "" })), ptrs: {} },
      // 第 0 行、第 0 列是边界（虚线）：有一边是空串。多开这一圈，i = 1 或 j = 1 时 dp[i-1][j-1] 才不会越界
      {
        t: "grid",
        label: "dp[i][j]（虚线是边界，箭头表示状态转移来源）",
        rows: dp.map((r, i) => r.map((v, j) => {
          const u = used.some(([x, y]) => x === i && y === j), edge = i === 0 || j === 0;
          const isCur = i === ci && j === cj;
          return {
            v: v === null ? "" : v,
            cls: fin && i === m && j === n ? "c" : isCur ? "a" : edge ? (u ? "x e" : "x") : u ? "e" : "",
          };
        })),
        feeds,
      },
    ];
    snap("边界", `dp 比两个单词各多开一行一列，这一圈是边界：<br>第 0 列 dp[i][0] = i：word2 取空串，把 word1 的前 i 个字符全删掉，要 i 步。<br>第 0 行 dp[0][j] = j：word1 取空串，插入 j 个字符，要 j 步。<br>注意边界不是 0：空串变成长度 j 的串一定要 j 步。如果不多开这一圈，算 dp[1][j] 时 dp[0][j−1] 的下标就越界了。`, view(-1, -1, []), { at: "init" });
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      if (A[i - 1] === B[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        snap(
          `(${i}, ${j}) 相同`,
          `最后一个字符都是 '${A[i - 1]}'，不用动。直接从左上角继承：dp[${i}][${j}] = dp[${i - 1}][${j - 1}] = <b>${dp[i][j]}</b>。`,
          view(i, j, [[i - 1, j - 1]], false, [{ from: [i - 1, j - 1], to: [i, j], label: "+0", win: true }]),
          { at: "same", facts: [["字符比较", `'${A[i - 1]}' = '${B[j - 1]}'`], ["操作", "无需操作"], ["dp[i][j]", dp[i][j]]] },
        );
      } else {
        const d = dp[i - 1][j], ins = dp[i][j - 1], r = dp[i - 1][j - 1];
        const best = Math.min(d, ins, r);
        dp[i][j] = 1 + best;
        const winDel = d === best && d <= ins && d <= r;
        const winIns = !winDel && ins === best && ins <= r;
        const winRep = !winDel && !winIns;
        const how = winRep ? `替换 '${A[i - 1]}' 为 '${B[j - 1]}'` : winDel ? `删除 '${A[i - 1]}'` : `插入 '${B[j - 1]}'`;
        snap(
          `(${i}, ${j}) 不同`,
          `'${A[i - 1]}' ≠ '${B[j - 1]}'：删除看上(${d}+1)、插入看左(${ins}+1)、替换看左上(${r}+1)。最小的是<b>${how}</b>，dp[${i}][${j}] = <b>${dp[i][j]}</b>。`,
          view(i, j, [[i - 1, j], [i, j - 1], [i - 1, j - 1]], false, [
            { from: [i - 1, j], to: [i, j], label: "删+1", win: winDel },
            { from: [i, j - 1], to: [i, j], label: "插+1", win: winIns },
            { from: [i - 1, j - 1], to: [i, j], label: "替+1", win: winRep },
          ]),
          { at: "diff", facts: [["字符比较", `'${A[i - 1]}' ≠ '${B[j - 1]}'`], ["最优", how], ["dp[i][j]", dp[i][j]]] },
        );
      }
    }
    snap("完成", `"${A}" 变成 "${B}" 最少要 <b>${dp[m][n]}</b> 步。`, view(-1, -1, [], true), { at: "done", kind: "ok", ans: dp[m][n] });
  },
  alts: [{
    t: "空间压缩成一行",
    code: "roll",
    note: "只留一行 dp：更新前的 dp[j] 是上面（删除），dp[j − 1] 已经是这一行的左边（插入）。麻烦的是左上角（替换 / 相同）：它是上一行的 dp[j − 1]，在更新左边那格时已经被覆盖了，所以要用 leftup 提前存一份。",
    legend: [["a", "正在算的 dp[j]"], ["k", "已经是这一行的值"], ["g", "还是上一行的值"], ["e", "这一步用到的"], ["x", "边界：有一边是空串"]],
    build(a, snap) {
      const A = a.w1, B = a.w2, m = A.length, n = B.length, dp = Array.from({ length: n + 1 }, (_, j) => j);
      let leftup = null, row = 0;
      const view = (j, used, opts = {}) => [
        { t: "array", label: "word1", idxFrom: 1, items: [...A].map((c, k) => ({ v: c, cls: k === row - 1 ? "a" : "" })) },
        { t: "array", label: "word2", idxFrom: 1, items: [...B].map((c, k) => ({ v: c, cls: k === j - 1 ? "a" : "" })) },
        {
          t: "array",
          label: row === 0 ? "dp（一行）：第 0 行，word1 取空串，插入 j 次（边界）" : j > n ? `dp（一行）：现在整行都是第 ${row} 行` : `dp（一行）：左边已经是第 ${row} 行，右边还是第 ${row - 1} 行`,
          items: dp.map((v, k) => ({
            v,
            ...(opts.prevMap && opts.prevMap[k] !== undefined ? { prev: opts.prevMap[k] } : {}),
            cls: k === j ? "a" : used.includes(k) ? (row === 0 || k === 0 ? "x e" : "e") : row === 0 || k === 0 ? "x" : k < j ? "k" : "g",
          })),
          feeds: opts.feeds || [],
        },
        {
          t: "chips",
          label: "临时变量",
          items: [
            { v: `leftup = ${leftup === null ? "—" : leftup}（左上角）`, cls: used.includes("lu") ? "e" : "" },
            ...(opts.up === undefined ? [] : [{ v: `up = ${opts.up}（上面）`, cls: used.includes("up") ? "e" : "" }]),
          ],
        },
      ];
      snap("边界", "只留一行 dp。一开始它是第 0 行：word1 取空串，变成 word2 的前 j 个字符要插入 j 次（边界）。", view(-1, []), { at: "init" });
      for (let i = 1; i <= m; i++) {
        const oldD0 = dp[0];
        const prevLu = leftup;
        leftup = oldD0;
        dp[0] = i;
        row = i;
        snap(
          `第 ${i} 行开始`,
          `开始算第 ${i} 行（'${A[i - 1]}'）。先把旧的 dp[0] = ${oldD0} 存进 leftup（给 dp[1] 当左上角），再把 dp[0] 改成 <b>${i}</b>。`,
          view(0, ["lu"], { prevMap: { 0: oldD0 } }),
          { at: "row", facts: [["leftup", leftup, prevLu === null ? "—" : prevLu], ["dp[0]", dp[0], oldD0]] },
        );
        for (let j = 1; j <= n; j++) {
          const up = dp[j];
          const lu = leftup;
          snap(
            `(${i}, ${j}) 先存 up`,
            `算 dp[${j}] 前，先把还没被覆盖的 dp[${j}]（上一行的值 <b>${up}</b>）存进 up，后面既要当「删除」用，又要留给下一格当 leftup。`,
            view(j, [j, "up"], { up }),
            { at: "saveUp", facts: [["leftup", lu], ["up (旧dp[j])", up]] },
          );
          if (A[i - 1] === B[j - 1]) {
            dp[j] = lu;
            snap(
              `(${i}, ${j}) 相同`,
              `'${A[i - 1]}' = '${B[j - 1]}'，直接取左上角 leftup = <b>${lu}</b> 写进 dp[${j}]。`,
              view(j, ["lu"], { up, prevMap: { [j]: up } }),
              { at: "same", facts: [["leftup", lu], ["dp[j]", dp[j], up]] },
            );
          } else {
            const ins = dp[j - 1];
            const best = Math.min(up, ins, lu);
            dp[j] = 1 + best;
            const how = lu <= up && lu <= ins ? "替换(leftup)" : up <= ins ? "删除(up)" : "插入(dp[j-1])";
            snap(
              `(${i}, ${j}) 不同`,
              `'${A[i - 1]}' ≠ '${B[j - 1]}'：删除 up=${up}、插入 dp[${j - 1}]=${ins}、替换 leftup=${lu}。最小的是${how}，加 1 得 dp[${j}] = <b>${dp[j]}</b>。`,
              view(j, ["up", "lu", j - 1], {
                up,
                prevMap: { [j]: up },
                feeds: [{ from: j - 1, to: j, label: "插", win: ins < up && ins <= lu }],
              }),
              { at: "diff", facts: [["leftup", lu], ["up", up], ["dp[j]", dp[j], up]] },
            );
          }
          leftup = up;
          snap(
            `(${i}, ${j}) 滚动 leftup`,
            `dp[${j}] 已经变成这一行的新值，把刚才记下的旧值 up = <b>${up}</b> 赋给 leftup，留给下一格 (${i}, ${j + 1}) 当左上角。`,
            view(j, ["up", "lu"], { up }),
            { at: "saveLu", facts: [["leftup", leftup, lu], ["up", up]] },
          );
        }
      }
      snap("完成", `dp[${n}] = <b>${dp[n]}</b>。一行加两个变量，空间 O(n)。`, view(n + 1, []), { at: "done", kind: "ok", ans: dp[n] });
    },
  }],
  points: [
    { t: "下标错一位", body: "dp 是 (m+1)×(n+1)，dp[i][j] 比较的是 word1[i-1] 和 word2[j-1]。" },
    { t: "三个方向的含义", body: "左上是替换（或相同时不动），上面是删除，左边是插入。记住这个对应关系就不会写错。" },
    { t: "复杂度", body: "时间 O(m·n)，空间 O(m·n)，可以压成一行加一个变量存左上角。" },
  ],
};
