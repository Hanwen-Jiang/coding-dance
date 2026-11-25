const F = require("../fig");

module.exports = {
  id: 118, name: "杨辉三角", title: "杨辉三角图解", level: "简单", topic: "动态规划",
  h1: "杨辉三角，每个数是肩上两个数的和",
  lede: "每一行的首尾都是 1，中间的每个数等于上一行左上方和正上方两个数的和。一行一行往下生成即可。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "1626927345-DZmfxB-PascalTriangleAnimated2.gif": [
      F.array([1], { idx: false, label: "每个数是它左上方和右上方两个数的和" }),
      F.array([1, 1], { idx: false }),
      F.array([1, 2, 1], { idx: false, cls: (v, i) => (i === 1 ? "e" : "") }),
      F.array([1, 3, 3, 1], { idx: false }),
      F.array([1, 4, 6, 4, 1], { idx: false }),
    ],
  },
  hints: [
    { t: "每行长什么样", body: ["第 <code>i</code> 行（从 0 开始）有 <code>i + 1</code> 个数，首尾都是 1。"] },
    { t: "中间的数怎么来", body: ["<code>row[j] = prev[j - 1] + prev[j]</code>，<code>prev</code> 是上一行，<code>1 &lt;= j &lt;= i - 1</code>。"] },
    { t: "一个小技巧", body: ["在上一行左边补一个 0 得到一个序列，右边补一个 0 得到另一个序列，两者逐位相加就是下一行。"] },
  ],
  codes: [{ t: "标准解法：逐行递推", code: `
class Solution:
    def generate(self, numRows: int) -> List[List[int]]:
        res = []                        #@init
        for i in range(numRows):        #@row
            row = [1] * (i + 1)             # 首尾是 1 #@row
            for j in range(1, i):       #@mid
                row[j] = res[i - 1][j - 1] + res[i - 1][j]  #@mid
            res.append(row)             #@row
        return res                      #@done
` }, { t: "简洁写法：错位相加", kind: "elegant", note: "[0] + prev 和 prev + [0] 错开一位，对应位置相加就是左上 + 正上。", code: `
class Solution:
    def generate(self, numRows: int) -> List[List[int]]:
        res = [[1]]
        for _ in range(numRows - 1):
            res.append([a + b for a, b in zip([0] + res[-1], res[-1] + [0])])
        return res
` }],
  sig: { fn: "generate", params: ["int"], ret: "List<List<int>>" },
  call: (a) => [a.n],
  cases: [[1], [2], [10]],
  pytest: `
s = Solution()
assert s.generate(5) == [[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]
assert s.generate(1) == [[1]]
assert s.generate(2) == [[1],[1,1]]
`,
  legend: [["a", "正在算的数"], ["e", "肩上的两个数"], ["c", "首尾的 1"]],
  presets: [
    { label: "5 行", args: { n: 5 }, note: "numRows = 5", expect: [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]] },
    { label: "3 行", args: { n: 3 }, note: "numRows = 3", expect: [[1], [1, 1], [1, 2, 1]] },
  ],
  build(a, snap) {
    const n = a.n, res = [];
    const view = (ci, cj) => res.map((row, i) => ({
      t: "array",
      label: `第 ${i} 行`,
      idx: false,
      items: row.map((v, j) => ({
        v,
        cls: i === ci && j === cj ? "a" : ci >= 0 && i === ci - 1 && (j === cj - 1 || j === cj) ? "e" : (j === 0 || j === row.length - 1) ? "c" : "",
      })),
    }));
    snap("开始", "从第 0 行 [1] 开始，一行一行往下生成。", [{ t: "note", label: "三角", html: "还没有" }], {
      at: "init",
      facts: [["目标行数", n], ["已生成行数", 0]],
    });
    for (let i = 0; i < n; i++) {
      const row = Array(i + 1).fill(null); row[0] = 1; row[i] = 1; res.push(row);
      snap(`第 ${i} 行`, `第 ${i} 行有 ${i + 1} 个数，先把首尾填成 1。`, view(-1, -1), {
        at: "row",
        facts: [["当前行", `第 ${i} 行`], ["已生成行数", res.length, res.length - 1], ["首尾", "填 1"]],
      });
      for (let j = 1; j < i; j++) {
        const leftUp = res[i - 1][j - 1], up = res[i - 1][j];
        row[j] = leftUp + up;
        snap(`第 ${i} 行`, `row[${j}] = 上一行的 ${leftUp} + ${up} = <b>${row[j]}</b>。`, view(i, j), {
          at: "mid",
          facts: [["肩上左", leftUp], ["肩上右", up], [`row[${j}]`, row[j]]],
        });
      }
    }
    snap("完成", `生成了 ${n} 行。`, view(-1, -1), {
      at: "done",
      kind: "ok",
      ans: res.map((r) => r.slice()),
      facts: [["总行数", n], ["最后一行", `[${res[n - 1].join(", ")}]`]],
    });
  },
  points: [
    { t: "j 的范围", body: "<code>range(1, i)</code>，第 0 行和第 1 行没有中间的数，循环自然不执行。" },
    { t: "它就是组合数", body: "第 i 行第 j 个数等于 C(i, j)。" },
    { t: "复杂度", body: "一共约 n²/2 个数，时间 O(n²)。" },
  ],
};
