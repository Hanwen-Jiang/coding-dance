module.exports = {
  id: 70, name: "爬楼梯", title: "爬楼梯图解", level: "简单", topic: "动态规划",
  h1: "爬楼梯，看最后一步怎么跨",
  lede: "到第 n 阶的最后一步，要么从 n − 1 阶跨 1 步上来，要么从 n − 2 阶跨 2 步上来。这两类走法没有重叠，所以方法数相加：f(n) = f(n − 1) + f(n − 2)。",
  hints: [
    { t: "只看最后一步", body: ["站在第 <code>n</code> 阶，上一步只可能在第 <code>n - 1</code> 阶或第 <code>n - 2</code> 阶。"] },
    { t: "写出递推式", body: ["<code>dp[i]</code> 表示爬到第 <code>i</code> 阶的方法数，<code>dp[i] = dp[i - 1] + dp[i - 2]</code>。", "初始值：<code>dp[0] = 1</code>（站着不动算一种），<code>dp[1] = 1</code>。"] },
    { t: "只需要前两个数", body: ["算 <code>dp[i]</code> 只用到前两项，用两个变量滚动就行，空间 O(1)。这就是斐波那契数列。"] },
  ],
  codes: [{ t: "标准解法：动态规划", code: `
class Solution:
    def climbStairs(self, n: int) -> int:
        dp = [0] * (n + 1)              #@init
        dp[0] = dp[1] = 1               #@init
        for i in range(2, n + 1):
            dp[i] = dp[i - 1] + dp[i - 2]   # 最后一步跨 1 阶或 2 阶 #@step
        return dp[n]                    #@done
` }, { t: "简洁写法：两个变量滚动（空间压缩）", key: "roll", kind: "elegant", note: "dp[i] 只用到前两项，用 a、b 两个变量记住 dp[i-1]、dp[i]，每走一阶往后挪一格。空间 O(1)。", code: `
class Solution:
    def climbStairs(self, n: int) -> int:
        a, b = 1, 1                         # 先是 dp[0]、dp[1] #@init
        for _ in range(n - 1):              #@step
            a, b = b, a + b                 # 往后挪一格：新的 b 是下一阶 #@step
        return b                            #@done
` }],
  pytest: `
s = Solution()
assert s.climbStairs(1) == 1
assert s.climbStairs(2) == 2
assert s.climbStairs(3) == 3
assert s.climbStairs(5) == 8
assert s.climbStairs(45) == 1836311903
`,
  sig: { fn: "climbStairs", params: ["int"], ret: "int" },
  call: (a) => [a.n],
  cases: [[1], [2], [45]],
  legend: [["a", "正在算的"], ["e", "用到的两项"], ["x", "边界：直接给定，不用算"], ["c", "答案"]],
  presets: [
    { label: "n = 5", args: { n: 5 }, note: "n = 5", expect: 8 },
    { label: "n = 3", args: { n: 3 }, note: "n = 3", expect: 3 },
  ],
  build(a, snap) {
    const n = a.n, dp = Array(n + 1).fill(null);
    dp[0] = 1; dp[1] = 1;
    // dp[0]、dp[1] 是边界（虚线）：直接给定，公式从 dp[2] 开始才用
    const view = (i, fin) => [{ t: "array", label: "dp[i]：爬到第 i 阶的方法数", items: dp.map((v, k) => {
      const used = i >= 0 && (k === i - 1 || k === i - 2);
      return { v, cls: fin && k === n ? "c" : k === i ? "a" : k < 2 ? (used ? "x e" : "x") : used ? "e" : "" };
    }), ptrs: { i: i >= 0 ? i : null } }];
    snap("边界", "dp[0]、dp[1] 是边界，直接给定：dp[1] = 1（只能跨 1 步）；dp[0] = 1 是「站在地面不动算一种」。<br>dp[0] 取 1 是为了让公式在 i = 2 也成立：dp[2] = dp[1] + dp[0] = 2。如果没有 dp[0]，算 dp[2] 时 dp[i − 2] 就越界了。", view(-1), { at: "init" });
    for (let i = 2; i <= n; i++) {
      dp[i] = dp[i - 1] + dp[i - 2];
      snap(`第 ${i} 阶`, `最后一步从第 ${i - 1} 阶跨 1 步（${dp[i - 1]} 种），或从第 ${i - 2} 阶跨 2 步（${dp[i - 2]} 种）。dp[${i}] = ${dp[i - 1]} + ${dp[i - 2]} = <b>${dp[i]}</b>。`, view(i), { at: "step", facts: [["dp[" + i + "]", dp[i]]] });
    }
    snap("完成", `爬到第 ${n} 阶一共有 <b>${dp[n]}</b> 种方法。`, view(-1, true), { at: "done", kind: "ok", ans: dp[n] });
  },
  alts: [{
    t: "两个变量滚动（空间压缩）",
    code: "roll",
    note: "算 dp[i] 只用到 dp[i − 1] 和 dp[i − 2]，更早的数再也用不到。所以只用 a、b 两个变量：a 是 dp[i − 1]，b 是 dp[i]。每走一阶，a, b = b, a + b，两个变量一起往后挪一格。",
    legend: [["e", "a"], ["a", "b"], ["d", "已经丢掉、不再保存的"], ["x", "边界"]],
    build(a, snap) {
      const n = a.n, vals = [1, 1];
      let i = 1;
      const view = (fin) => [
        { t: "array", label: "dp（灰色是已经丢掉的，代码里只存 a、b 两个数）", items: Array.from({ length: n + 1 }, (_, k) => ({ v: k < vals.length ? vals[k] : "", cls: fin && k === n ? "c" : k === i ? "a" : k === i - 1 ? (k < 2 ? "x e" : "e") : k < i - 1 ? "d" : "" })), ptrs: { a: i - 1, b: i } },
        { t: "chips", label: "代码里只有这两个变量", items: [{ v: `a = ${vals[i - 1]}（dp[${i - 1}]）`, cls: "e" }, { v: `b = ${vals[i]}（dp[${i}]）`, cls: "a" }] },
      ];
      snap("开始", "a、b 先是 dp[0]、dp[1]，都是 1（边界）。", view(false), { at: "init" });
      while (i < n) {
        const na = vals[i], nb = vals[i - 1] + vals[i];
        vals.push(nb); i++;
        snap(`第 ${i} 阶`, `a, b = b, a + b：新的 b = ${vals[i - 2]} + ${na} = <b>${nb}</b>，就是 dp[${i}]；a 变成原来的 b（dp[${i - 1}] = ${na}）。dp[${i - 2}] 再也用不到，丢掉。`, view(false), { at: "step" });
      }
      snap("完成", `b = dp[${n}] = <b>${vals[n]}</b>。整个过程只用了两个变量，空间 O(1)。`, view(true), { at: "done", kind: "ok", ans: vals[n] });
    },
  }],
  points: [
    { t: "dp[0] = 1 的含义", body: "不是「0 阶有 1 种爬法」这么生硬，而是让 dp[2] = dp[1] + dp[0] = 2 成立。也可以直接从 dp[1]=1, dp[2]=2 开始。" },
    { t: "不要直接递归", body: "不加记忆化的递归会重复算很多次，n = 45 时会超时。" },
    { t: "复杂度", body: "时间 O(n)，滚动变量写法空间 O(1)。" },
  ],
};
