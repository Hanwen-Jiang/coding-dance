module.exports = {
  slug: "dp-basics", name: "动态规划入门", kind: "algo", order: 11,
  lede: "动态规划把大问题拆成规模更小的同类问题，并把小问题的答案存在表里，后面直接查。写 DP 只要回答四个问题：dp[i] 表示什么、它从哪几个更小的状态转移过来、边界是什么（越界的地方算多少）、按什么顺序填表。很多 DP 只依赖上一行或前几项，还能把表压成一行或几个变量。",
  related: [70, 198, 62, 64, 322, 416, 1143, 72, 300, 279, 139, 152],
  sections: [{
    key: "one", t: "一维：使用最小花费爬楼梯",
    body: [
      "<code>dp[i]</code>：爬到第 i 阶（还没付第 i 阶的钱）最少花多少。最后一步要么从第 i−1 阶跨 1 步（付 <code>cost[i-1]</code>），要么从第 i−2 阶跨 2 步（付 <code>cost[i-2]</code>），取小的：<code>dp[i] = min(dp[i-1] + cost[i-1], dp[i-2] + cost[i-2])</code>。",
      "<b>边界</b>：可以从第 0 阶或第 1 阶出发，所以 <code>dp[0] = dp[1] = 0</code>，直接给定。公式从 i = 2 开始用，这时 i−2 = 0 正好不越界。楼顶是第 n 阶，答案是 <code>dp[n]</code>。",
      "<b>空间压缩</b>：dp[i] 只用到前两项，用两个变量滚动就行，空间 O(1)。",
    ],
    points: [
      { t: "楼顶是第 n 阶", body: "cost 有 n 项（第 0 到 n−1 阶），楼顶在它们之后，所以 dp 开 n + 1 格。" },
      { t: "先写出表，再压缩", body: "一开始就写滚动变量容易错。先写出完整的 dp 数组，确认只依赖前两项，再改成两个变量。" },
    ],
    codes: [{ t: "dp 数组", key: "one", code: `
class Solution:
    def minCostClimbingStairs(self, cost: List[int]) -> int:
        n = len(cost)
        dp = [0] * (n + 1)                  # 边界 dp[0] = dp[1] = 0：从第 0 或第 1 阶出发不花钱 #@init
        for i in range(2, n + 1):
            dp[i] = min(dp[i - 1] + cost[i - 1], dp[i - 2] + cost[i - 2])  # 跨 1 步或跨 2 步上来 #@step
        return dp[n]                        # 楼顶是第 n 阶 #@done
` }, { t: "空间压缩：两个变量", key: "one-roll", note: "dp[i] 只用到 dp[i−1] 和 dp[i−2]：a 是 dp[i−2]，b 是 dp[i−1]，每算一阶两个变量一起往后挪。", code: `
class Solution:
    def minCostClimbingStairs(self, cost: List[int]) -> int:
        a = b = 0                           # dp[0]、dp[1] #@init
        for i in range(2, len(cost) + 1):   #@step
            a, b = b, min(b + cost[i - 1], a + cost[i - 2])    # 新的 b 是 dp[i] #@step
        return b                            #@done
` }],
    sig: { fn: "minCostClimbingStairs", params: ["int[]"], ret: "int" },
    call: (a) => [a.cost],
    cases: [[[10, 15, 20]], [[1, 100, 1, 1, 1, 100, 1, 1, 100, 1]], [[0, 0]], [[5, 3]]],
    gen: (R) => { const cost = R.arr(R.int(2, 8), 0, 9); return { args: { cost }, note: `cost = ${R.fmt(cost)}` }; },
    demo: {
      method: "dp 数组",
      legend: [["a", "正在算的 dp[i]"], ["e", "用到的两项"], ["x", "边界：直接给定"], ["c", "答案"]],
      presets: [{ label: "示例 2", args: { cost: [1, 100, 1, 1, 1, 100, 1, 1, 100, 1] }, note: "cost = [1,100,1,1,1,100,1,1,100,1]", expect: 6 }, { label: "示例 1", args: { cost: [10, 15, 20] }, note: "cost = [10,15,20]", expect: 15 }],
      build(a, snap) {
        const C = a.cost, n = C.length, dp = new Array(n + 1).fill(null);
        dp[0] = 0; dp[1] = 0;
        const view = (i, fin) => [
          { t: "array", label: "cost", items: C.map((v, k) => ({ v, cls: i >= 0 && (k === i - 1 || k === i - 2) ? "e" : "" })) },
          { t: "array", label: "dp[i]：爬到第 i 阶的最小花费（第 n 阶是楼顶）", items: dp.map((v, k) => ({ v: v ?? "", cls: fin && k === n ? "c" : k === i ? "a" : k < 2 ? (i >= 0 && k >= i - 2 ? "x e" : "x") : i >= 0 && (k === i - 1 || k === i - 2) ? "e" : "" })), ptrs: { i: i >= 0 ? i : null } },
        ];
        snap("边界", "dp[0]、dp[1] 是边界：可以直接从第 0 阶或第 1 阶出发，不花钱，都是 0。<br>公式要读 dp[i − 2]，从 i = 2 开始用，正好读到 dp[0]，不会越界。", view(-1), { at: "init" });
        for (let i = 2; i <= n; i++) {
          const one = dp[i - 1] + C[i - 1], two = dp[i - 2] + C[i - 2];
          dp[i] = Math.min(one, two);
          snap(`第 ${i} 阶`, `从第 ${i - 1} 阶跨 1 步：${dp[i - 1]} + ${C[i - 1]} = ${one}；从第 ${i - 2} 阶跨 2 步：${dp[i - 2]} + ${C[i - 2]} = ${two}。取小的，dp[${i}] = <b>${dp[i]}</b>。`, view(i), { at: "step" });
        }
        snap("完成", `楼顶是第 ${n} 阶，最少花费 <b>${dp[n]}</b>。`, view(-1, true), { at: "done", kind: "ok", ans: dp[n] });
      },
      alts: [{
        t: "空间压缩：两个变量",
        code: "one-roll",
        note: "算 dp[i] 只用到 dp[i − 1] 和 dp[i − 2]，更早的不再需要。a 存 dp[i − 2]，b 存 dp[i − 1]；算出 dp[i] 以后 a, b = b, dp[i]，一起往后挪一格。",
        legend: [["e", "a"], ["a", "b"], ["d", "已经丢掉的"], ["x", "边界"], ["c", "答案"]],
        build(a, snap) {
          const C = a.cost, n = C.length, vals = [0, 0];
          let i = 1;
          const view = (fin) => [
            { t: "array", label: "dp（灰的已经丢掉，代码里只有 a、b）", items: Array.from({ length: n + 1 }, (_, k) => ({ v: k < vals.length ? vals[k] : "", cls: fin && k === n ? "c" : k === i ? (k < 2 ? "x" : "a") : k === i - 1 ? (k < 2 ? "x e" : "e") : k < i - 1 ? "d" : "" })), ptrs: { a: i - 1, b: i } },
            { t: "chips", label: "代码里只有这两个变量", items: [{ v: `a = ${vals[i - 1]}（dp[${i - 1}]）`, cls: "e" }, { v: `b = ${vals[i]}（dp[${i}]）`, cls: "a" }] },
          ];
          snap("开始", "a、b 先是 dp[0]、dp[1]，都是 0（边界）。", view(false), { at: "init" });
          while (i < n) {
            const A0 = vals[i - 1], B0 = vals[i], nb = Math.min(B0 + C[i], A0 + C[i - 1]);
            vals.push(nb); i++;
            snap(`第 ${i} 阶`, `新的 b = min(b + cost[${i - 1}], a + cost[${i - 2}]) = min(${B0} + ${C[i - 1]}, ${A0} + ${C[i - 2]}) = <b>${nb}</b>，就是 dp[${i}]；a 变成原来的 b。dp[${i - 2}] 再也用不到了。`, view(false), { at: "step" });
          }
          snap("完成", `b = dp[${n}] = <b>${vals[n]}</b>，只用了两个变量。`, view(true), { at: "done", kind: "ok", ans: vals[n] });
        },
      }],
    },
  }, {
    key: "two", t: "二维：有障碍的不同路径",
    body: [
      "<code>dp[i][j]</code>：从左上角走到 (i, j) 的路径数。只能向右或向下走，所以上一步要么在上面、要么在左边：<code>dp[i][j] = dp[i-1][j] + dp[i][j-1]</code>。是障碍的格子走不到，<code>dp = 0</code>。",
      "<b>边界</b>：第 0 行的「上面」、第 0 列的「左边」越界了，那里不存在，没有路能从那里来，算 <b>0</b>。起点 <code>dp[0][0] = 1</code> 直接给定（起点是障碍时就是 0）。演示里表外的虚线格子就是越界的位置。",
      "<b>空间压缩</b>：算第 i 行只用到第 i−1 行和第 i 行左边，留一行 dp 就够了：更新前的 <code>dp[j]</code> 是上面，<code>dp[j-1]</code> 已经是这一行的左边。",
    ],
    points: [
      { t: "越界当 0", body: "也可以多开一行一列（<code>dp</code> 大小 (m+1)×(n+1)），把越界的位置变成真实存在的 0，就不用判断 <code>i &gt; 0</code>。" },
      { t: "障碍要清零", body: "压缩成一行时，遇到障碍一定要把 <code>dp[j]</code> 设成 0，否则会留着上一行的值。" },
    ],
    codes: [{ t: "二维表", key: "two", code: `
class Solution:
    def uniquePathsWithObstacles(self, obstacleGrid: List[List[int]]) -> int:
        m, n = len(obstacleGrid), len(obstacleGrid[0])
        dp = [[0] * n for _ in range(m)]        # dp[i][j]：走到 (i, j) 的路径数 #@init
        for i in range(m):
            for j in range(n):
                if obstacleGrid[i][j] == 1:     # 障碍：走不到 #@block
                    dp[i][j] = 0                #@block
                elif i == 0 and j == 0:         # 起点，直接给定 #@start
                    dp[i][j] = 1                #@start
                else:                           # 从上面来 + 从左边来，越界的当 0 #@cell
                    dp[i][j] = (dp[i - 1][j] if i > 0 else 0) + (dp[i][j - 1] if j > 0 else 0)  #@cell
        return dp[m - 1][n - 1]                 #@done
` }, { t: "空间压缩：一行", key: "two-roll", note: "只留一行 dp。dp[0] 先设成 1，相当于起点上面有一条「虚拟」的路；之后每一行从左往右更新：原来的 dp[j] 是上面，dp[j-1] 是刚算好的左边。", code: `
class Solution:
    def uniquePathsWithObstacles(self, obstacleGrid: List[List[int]]) -> int:
        n = len(obstacleGrid[0])
        dp = [0] * n                            # 一行：第 -1 行（越界）全是 0 #@init
        dp[0] = 1                               # 只给起点上面放一条路，起点就是 1 #@init
        for row in obstacleGrid:                #@row
            for j in range(n):
                if row[j] == 1:                 # 障碍：清零 #@block
                    dp[j] = 0                   #@block
                elif j > 0:                     # 原来的 dp[j] 是上面，dp[j-1] 是刚算好的左边 #@cell
                    dp[j] += dp[j - 1]          #@cell
        return dp[n - 1]                        #@done
` }],
    sig: { fn: "uniquePathsWithObstacles", params: ["int[][]"], ret: "int" },
    call: (a) => [a.grid],
    cases: [[[[0, 0, 0], [0, 1, 0], [0, 0, 0]]], [[[0, 1], [0, 0]]], [[[1]]], [[[0]]], [[[0, 0], [1, 1], [0, 0]]]],
    gen: (R) => { const m = R.int(2, 4), n = R.int(2, 5), grid = Array.from({ length: m }, () => Array.from({ length: n }, () => (R.chance(0.2) ? 1 : 0))); return { args: { grid }, note: `obstacleGrid = ${R.fmt(grid)}` }; },
    demo: {
      method: "二维表",
      legend: [["a", "正在算的格子"], ["e", "上面和左边"], ["x", "边界：越界的位置（当 0）和起点"], ["d", "障碍"], ["c", "终点"]],
      presets: [{ label: "示例 1", args: { grid: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] }, note: "obstacleGrid = [[0,0,0],[0,1,0],[0,0,0]]", expect: 2 }, { label: "3 × 4", args: { grid: [[0, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]] }, note: "obstacleGrid = [[0,0,0,0],[0,1,0,0],[0,0,0,1]]", expect: 0 }],
      build(a, snap) {
        const G = a.grid, m = G.length, n = G[0].length, dp = G.map((r) => r.map(() => null));
        // 表外多画一圈虚线：第 -1 行、第 -1 列越界，当 0
        const view = (ci, cj, fin) => {
          const upOut = ci === 0 && cj > 0, leftOut = cj === 0 && ci > 0;
          return [{
            t: "grid", label: "dp[i][j]：走到 (i, j) 的路径数（虚线是越界的位置，当 0）",
            rowLabels: [-1, ...G.map((_, i) => i)], colLabels: [-1, ...G[0].map((_, j) => j)],
            rows: [
              [{ v: "", cls: "x" }, ...G[0].map((_, j) => ({ v: 0, cls: upOut && j === cj ? "x e" : "x" }))],
              ...G.map((r, i) => [{ v: 0, cls: leftOut && i === ci ? "x e" : "x" }, ...r.map((o, j) => ({ v: o ? "障" : dp[i][j] ?? "", cls: o ? "d" : fin && i === m - 1 && j === n - 1 ? "c" : i === ci && j === cj ? "a" : (i === ci - 1 && j === cj) || (i === ci && j === cj - 1) ? "e" : i === 0 && j === 0 ? "x" : "" }))]),
            ],
          }];
        };
        snap("开始", "从左上角一行行、从左往右填表。表外一圈虚线是越界的位置：那里不存在，没有路从那里来，当 <b>0</b>。", view(-1, -1), { at: "init" });
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
          if (G[i][j] === 1) { dp[i][j] = 0; snap(`(${i}, ${j})`, "这里是障碍，走不到，dp = 0。", view(i, j), { at: "block" }); continue; }
          if (i === 0 && j === 0) { dp[0][0] = 1; snap("起点", "起点直接给定：dp[0][0] = 1（站在起点本身算一条路）。", view(0, 0), { at: "start" }); continue; }
          const up = i > 0 ? dp[i - 1][j] : 0, left = j > 0 ? dp[i][j - 1] : 0;
          dp[i][j] = up + left;
          const why = i === 0 ? "上面越界了，当 0" : j === 0 ? "左边越界了，当 0" : "";
          snap(`(${i}, ${j})`, `上面 ${i > 0 ? `(${i - 1}, ${j})` : "(-1, " + j + ")"} 是 ${up}，左边 ${j > 0 ? `(${i}, ${j - 1})` : "(" + i + ", -1)"} 是 ${left}${why ? `（${why}）` : ""}。dp = ${up} + ${left} = <b>${dp[i][j]}</b>。`, view(i, j), { at: "cell" });
        }
        snap("完成", `走到右下角一共 <b>${dp[m - 1][n - 1]}</b> 条路径。`, view(-1, -1, true), { at: "done", kind: "ok", ans: dp[m - 1][n - 1] });
      },
      alts: [{
        t: "空间压缩：一行",
        code: "two-roll",
        note: "算第 i 行只用到第 i − 1 行（上面）和第 i 行左边的格子，所以只留一行 dp。更新 dp[j] 前它存的是上一行的值（上面）；dp[j − 1] 已经更新过，是这一行的值（左边）。",
        legend: [["a", "正在更新的 dp[j]"], ["k", "已经是这一行的值"], ["g", "还是上一行的值"], ["x", "第 -1 行（越界，当 0；起点上面给 1）"], ["d", "障碍"]],
        build(a, snap) {
          const G = a.grid, m = G.length, n = G[0].length, dp = new Array(n).fill(0);
          dp[0] = 1;
          let row = -1, col = -1;
          const view = (fin) => [
            { t: "grid", label: "障碍", ax: false, rows: G.map((r, i) => r.map((o, j) => ({ v: o ? "障" : "", cls: o ? "d" : i === row && j === col ? "a" : "" }))) },
            { t: "array", label: row < 0 ? "dp（一行）：现在是第 -1 行" : `dp（一行）：左边已经是第 ${row} 行，右边还是第 ${row - 1} 行`, items: dp.map((v, j) => ({ v, cls: fin && j === n - 1 ? "c" : j === col ? "a" : row < 0 ? "x" : j < col ? "k" : "g" })), ptrs: { j: col >= 0 ? col : null } },
          ];
          snap("开始", "一行 dp 先当作越界的第 -1 行：全是 0，只有起点上面放 1，这样第 0 行的公式不用特殊处理。", view(false), { at: "init" });
          for (let i = 0; i < m; i++) {
            row = i; col = -1;
            snap(`第 ${i} 行`, `开始算第 ${i} 行，dp 里现在整行都是第 ${i - 1} 行的值。`, view(false), { at: "row" });
            for (let j = 0; j < n; j++) {
              col = j;
              if (G[i][j] === 1) { dp[j] = 0; snap(`(${i}, ${j})`, "障碍：dp[j] 清零。", view(false), { at: "block" }); continue; }
              if (j === 0) { snap(`(${i}, 0)`, `第 0 列只能从上面来，dp[0] = ${dp[0]} 不用改。`, view(false), { at: "cell" }); continue; }
              const up = dp[j], left = dp[j - 1];
              dp[j] = up + left;
              snap(`(${i}, ${j})`, `dp[${j}] 更新前是 ${up}（上一行，<b>上面</b>），dp[${j - 1}] = ${left}（这一行，<b>左边</b>）。dp[${j}] = <b>${dp[j]}</b>。`, view(false), { at: "cell" });
            }
          }
          col = -1;
          snap("完成", `dp[${n - 1}] = <b>${dp[n - 1]}</b>，空间从 O(m·n) 降到 O(n)。`, view(true), { at: "done", kind: "ok", ans: dp[n - 1] });
        },
      }],
    },
  }, {
    key: "knapsack", t: "0-1 背包",
    body: [
      "n 件物品，第 i 件重 <code>w</code>、值 <code>v</code>，每件最多拿一次，背包容量为 capacity，最多能装多少价值？",
      "<code>dp[i][c]</code>：只考虑前 i 件物品、容量为 c 时的最大价值。第 i 件<b>不选</b>：<code>dp[i-1][c]</code>；<b>选</b>（要装得下 <code>c &gt;= w</code>）：容量先让出 w，<code>dp[i-1][c-w] + v</code>。两者取大。<b>边界</b>：一件物品都没有时价值是 0，<code>dp[0][c] = 0</code>。",
      "<b>空间压缩</b>：第 i 行只用到第 i−1 行，可以压成一行。但「选」要读的 <code>dp[i-1][c-w]</code> 在左边，所以容量要<b>从大到小</b>倒着更新——这样读到的 <code>dp[c-w]</code> 还没被这一行覆盖，仍然是上一行的值。正着更新就变成了每件物品能拿无限次（完全背包）。",
    ],
    points: [
      { t: "倒序是关键", body: "0-1 背包压成一行时容量倒着枚举；完全背包（零钱兑换 322）正着枚举。" },
      { t: "分割等和子集（416）", body: "就是容量为 sum/2 的 0-1 背包，问能不能正好装满。" },
    ],
    codes: [{ t: "二维表", key: "knapsack", code: `
class Solution:
    def knapsack(self, weights: List[int], values: List[int], capacity: int) -> int:
        n = len(weights)
        dp = [[0] * (capacity + 1) for _ in range(n + 1)]   # 边界：dp[0][c] = 0，没有物品就没有价值 #@init
        for i in range(1, n + 1):
            w, v = weights[i - 1], values[i - 1]
            for c in range(capacity + 1):
                dp[i][c] = dp[i - 1][c]                     # 不选第 i 件 #@skip
                if c >= w:                                  # 装得下才能选 #@take
                    dp[i][c] = max(dp[i][c], dp[i - 1][c - w] + v)  # 选：让出 w 的容量，价值多 v #@take
        return dp[n][capacity]                              #@done
` }, { t: "空间压缩：一行，倒着更新", key: "knapsack-roll", note: "只留一行 dp[c]。每件物品让容量从大到小更新：dp[c - w] 在 dp[c] 左边，倒着走时它还没被这一行覆盖，仍然是上一行的值。", code: `
class Solution:
    def knapsack(self, weights: List[int], values: List[int], capacity: int) -> int:
        dp = [0] * (capacity + 1)                       # 一行：一件物品都没有时全是 0 #@init
        for w, v in zip(weights, values):               #@item
            for c in range(capacity, w - 1, -1):        # 倒着更新：dp[c - w] 还是上一行的值 #@cell
                dp[c] = max(dp[c], dp[c - w] + v)       #@cell
        return dp[capacity]                             #@done
` }],
    sig: { fn: "knapsack", params: ["int[]", "int[]", "int"], ret: "int" },
    call: (a) => [a.weights, a.values, a.capacity],
    cases: [[[1, 3, 4], [15, 20, 30], 4], [[2], [5], 1], [[1, 1, 1], [10, 20, 30], 2], [[5, 4, 6, 3], [10, 40, 30, 50], 10]],
    gen: (R) => { const n = R.int(2, 4), weights = R.arr(n, 1, 5), values = R.arr(n, 1, 20), capacity = R.int(3, 8); return { args: { weights, values, capacity }, note: `weights = ${R.fmt(weights)}, values = ${R.fmt(values)}, capacity = ${capacity}` }; },
    demo: {
      method: "二维表",
      legend: [["a", "正在算的格子"], ["e", "用到的上一行的格子"], ["x", "边界：没有物品，价值 0"], ["c", "答案"]],
      presets: [{ label: "示例", args: { weights: [1, 3, 4], values: [15, 20, 30], capacity: 4 }, note: "weights = [1,3,4], values = [15,20,30], capacity = 4", expect: 35 }],
      build(a, snap) {
        const W = a.weights, V = a.values, n = W.length, cap = a.capacity;
        const dp = Array.from({ length: n + 1 }, (_, i) => new Array(cap + 1).fill(i === 0 ? 0 : null));
        const view = (ci, cc, reads, fin) => [{
          t: "grid", label: "dp[i][c]：前 i 件物品、容量 c（行是物品数，列是容量）",
          rowLabels: dp.map((_, i) => (i === 0 ? "0" : `${i}（${W[i - 1]}/${V[i - 1]}）`)),
          rows: dp.map((r, i) => r.map((v, c) => ({ v: v ?? "", cls: fin && i === n && c === cap ? "c" : i === ci && c === cc ? "a" : reads.some(([x, y]) => x === i && y === c) ? (i === 0 ? "x e" : "e") : i === 0 ? "x" : "" }))),
        }];
        snap("边界", "第 0 行是边界：一件物品都没有，不管容量多大，价值都是 0。行号旁边写的是这件物品的「重量/价值」。", view(-1, -1, []), { at: "init" });
        for (let i = 1; i <= n; i++) {
          const w = W[i - 1], v = V[i - 1];
          for (let c = 0; c <= cap; c++) {
            const skip = dp[i - 1][c];
            if (c < w) { dp[i][c] = skip; snap(`第 ${i} 件、容量 ${c}`, `第 ${i} 件重 ${w}，容量 ${c} 装不下，只能不选：dp = dp[${i - 1}][${c}] = <b>${skip}</b>。`, view(i, c, [[i - 1, c]]), { at: ["skip", "take"] }); continue; }
            const take = dp[i - 1][c - w] + v;
            dp[i][c] = Math.max(skip, take);
            snap(`第 ${i} 件、容量 ${c}`, `不选：dp[${i - 1}][${c}] = ${skip}；选：让出 ${w} 的容量，dp[${i - 1}][${c - w}] + ${v} = ${take}。取大的，dp = <b>${dp[i][c]}</b>。`, view(i, c, [[i - 1, c], [i - 1, c - w]]), { at: ["skip", "take"] });
          }
        }
        snap("完成", `前 ${n} 件物品、容量 ${cap} 时最多装 <b>${dp[n][cap]}</b> 的价值。`, view(-1, -1, [], true), { at: "done", kind: "ok", ans: dp[n][cap] });
      },
      alts: [{
        t: "空间压缩：一行，倒着更新",
        code: "knapsack-roll",
        note: "第 i 行只用到第 i − 1 行，留一行 dp[c] 就够了。容量从大到小更新：要读的 dp[c − w] 在左边，还没被这一行覆盖，仍然是上一行的值。",
        legend: [["a", "正在更新的 dp[c]"], ["e", "读到的 dp[c − w]（还是上一行）"], ["k", "已经是这一行的值"], ["g", "还是上一行的值"], ["x", "一件物品都没有时（全是 0）"]],
        build(a, snap) {
          const W = a.weights, V = a.values, n = W.length, cap = a.capacity, dp = new Array(cap + 1).fill(0);
          let item = -1, cur = -1, rd = -1;
          const view = (fin) => [{ t: "array", label: item < 0 ? "dp（一行）：现在是第 0 行" : `dp（一行）：放第 ${item + 1} 件（重 ${W[item]}、值 ${V[item]}），右边已经是这一行，左边还是上一行`, items: dp.map((v, c) => ({ v, cls: fin && c === cap ? "c" : c === cur ? "a" : c === rd ? "e" : item < 0 ? "x" : cur >= 0 && c > cur ? "k" : "g" })), ptrs: { c: cur >= 0 ? cur : null } }];
          snap("开始", "一行 dp 先是第 0 行：一件物品都没有，全是 0。", view(false), { at: "init" });
          for (let i = 0; i < n; i++) {
            item = i; cur = -1; rd = -1;
            const w = W[i], v = V[i];
            snap(`第 ${i + 1} 件`, `放第 ${i + 1} 件（重 ${w}、值 ${v}）。容量从 ${cap} 倒着更新到 ${w}（比 ${w} 小的装不下，不用改）。`, view(false), { at: "item" });
            for (let c = cap; c >= w; c--) {
              cur = c; rd = c - w;
              const old = dp[c], take = dp[c - w] + v;
              dp[c] = Math.max(old, take);
              snap(`容量 ${c}`, `不选：dp[${c}] 还是上一行的 ${old}；选：dp[${c - w}] = ${dp[c - w]}（在左边，还没更新，是上一行的值）+ ${v} = ${take}。dp[${c}] = <b>${dp[c]}</b>。`, view(false), { at: "cell" });
            }
          }
          cur = -1; rd = -1;
          snap("完成", `dp[${cap}] = <b>${dp[cap]}</b>。只用了一行，空间 O(capacity)。`, view(true), { at: "done", kind: "ok", ans: dp[cap] });
        },
      }],
    },
  }],
};
