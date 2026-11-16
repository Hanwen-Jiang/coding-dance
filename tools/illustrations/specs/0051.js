const F = require("../fig");

module.exports = {
  id: 51, name: "N 皇后", title: "N 皇后图解", level: "困难", topic: "回溯",
  h1: "N 皇后，一行放一个，三个集合查冲突",
  lede: "每行恰好放一个皇后，所以按行往下放，每行只需要决定放在哪一列。冲突只可能来自三个方向：同一列、同一条主对角线、同一条副对角线，各用一个集合记下来，O(1) 就能判断。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "queens.jpg": [F.row([".Q..|...Q|Q...|..Q.", "..Q.|Q...|...Q|.Q.."].map((b) => F.grid(b.split("|").map((r) => [...r].map((c) => (c === "Q" ? "Q" : ""))), { cls: (v) => (v ? "a" : "") })), { sep: "", label: "4 皇后的两种摆法：任意两个皇后不同行、不同列、不在同一条斜线上" })],
  },
  hints: [
    { t: "按行放", body: ["n 个皇后放在 n 行里，不能同行，所以每行正好一个。", "递归 <code>dfs(r)</code> 负责给第 <code>r</code> 行挑一列，挑好就去下一行。"] },
    { t: "怎么判断冲突", body: ["同一列：列号 <code>c</code> 相同。", "同一条「\\」斜线：<code>r - c</code> 相同；同一条「/」斜线：<code>r + c</code> 相同。", "用三个集合 <code>cols</code>、<code>diag1</code>、<code>diag2</code> 记下已经被占的值。"] },
    { t: "放不下就回溯", body: ["某一行每一列都冲突，说明上面的摆法不行，退回上一行换一列。", "退回时要把这个皇后从三个集合里删掉。"] },
  ],
  codes: [{ t: "标准解法：回溯 + 三个集合", code: `
class Solution:
    def solveNQueens(self, n: int) -> List[List[str]]:
        res, queens = [], []                # queens[r]：第 r 行皇后所在的列 #@init
        cols, diag1, diag2 = set(), set(), set()    #@init

        def dfs(r):
            if r == n:                      #@found
                res.append(["." * c + "Q" + "." * (n - c - 1) for c in queens])   #@found
                return                      #@found
            for c in range(n):              #@place
                if c in cols or r - c in diag1 or r + c in diag2:   #@place
                    continue                # 同列或同一条斜线上已经有皇后 #@place
                queens.append(c)            #@place
                cols.add(c); diag1.add(r - c); diag2.add(r + c)     #@place
                dfs(r + 1)                  #@place
                queens.pop()                #@back
                cols.remove(c); diag1.remove(r - c); diag2.remove(r + c)    #@back

        dfs(0)                              #@init
        return res                          #@done
` }, { t: "简洁写法：生成器 + 现场检查", kind: "elegant", note: "第 i 行的皇后在列 q。新皇后放在第 r 行第 c 列，不冲突的条件是列不同，且列差不等于行差。", code: `
class Solution:
    def solveNQueens(self, n: int) -> List[List[str]]:
        def dfs(qs):
            r = len(qs)
            if r == n:
                yield ["." * c + "Q" + "." * (n - c - 1) for c in qs]
                return
            for c in range(n):
                if all(c != q and abs(c - q) != r - i for i, q in enumerate(qs)):
                    yield from dfs(qs + [c])
        return list(dfs([]))
` }],
  sig: { fn: "solveNQueens", params: ["int"], ret: "List<List<string>>", cmp: "unordered" },
  call: (a) => [a.n],
  cases: [[1], [2], [3], [6]],
  pytest: `
s = Solution()
assert s.solveNQueens(4) == [[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]]
assert s.solveNQueens(1) == [["Q"]]
assert len(s.solveNQueens(6)) == 4
assert len(s.solveNQueens(8)) == 92
`,
  legend: [["a", "刚放的皇后"], ["c", "已经放好的皇后"], ["d", "被攻击到的格子"], ["k", "找到的一种摆法"]],
  presets: [
    { label: "n = 4", args: { n: 4 }, note: "n = 4", expect: [[".Q..", "...Q", "Q...", "..Q."], ["..Q.", "Q...", "...Q", ".Q.."]] },
    { label: "n = 5", args: { n: 5 }, note: "n = 5", expect: [["Q....", "..Q..", "....Q", ".Q...", "...Q."], ["Q....", "...Q.", ".Q...", "....Q", "..Q.."], [".Q...", "...Q.", "Q....", "..Q..", "....Q"], [".Q...", "....Q", "..Q..", "Q....", "...Q."], ["..Q..", "Q....", "...Q.", ".Q...", "....Q"], ["..Q..", "....Q", ".Q...", "...Q.", "Q...."], ["...Q.", "Q....", "..Q..", "....Q", ".Q..."], ["...Q.", ".Q...", "....Q", "..Q..", "Q...."], ["....Q", ".Q...", "...Q.", "Q....", "..Q.."], ["....Q", "..Q..", "Q....", "...Q.", ".Q..."]] },
  ],
  build(a, snap) {
    const n = a.n, q = [], res = [];
    const hit = (r, c) => q.some((x, i) => x === c || Math.abs(x - c) === Math.abs(r - i));
    const view = (done) => [{ t: "grid", label: "棋盘", rows: Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => {
      if (q[r] === c) return { v: "Q", cls: done ? "k" : r === q.length - 1 ? "a" : "c" };
      return { v: "", cls: r >= q.length && hit(r, c) ? "d" : "" };
    })) }];
    const f = () => ({ facts: [["已放", `${q.length} / ${n}`], ["找到", res.length]] });
    snap("开始", `在 ${n}×${n} 的棋盘上放 ${n} 个皇后。从第 0 行开始，一行放一个。`, view(), { at: "init", ...f() });
    const dfs = (r) => {
      if (r === n) { res.push(q.map((c) => ".".repeat(c) + "Q" + ".".repeat(n - c - 1))); snap("找到", `${n} 行都放好了，记下这种摆法（第 ${res.length} 种）。`, view(true), { at: "found", kind: "ok", ...f() }); return; }
      let any = false;
      for (let c = 0; c < n; c++) {
        if (hit(r, c)) continue;
        any = true; q.push(c);
        snap(`第 ${r} 行`, `第 ${r} 行第 ${c} 列没有被攻击，放一个皇后。灰色是它和上面的皇后能攻击到的格子。`, view(), { at: "place", ...f() });
        dfs(r + 1);
        q.pop();
      }
      if (r > 0) snap("回溯", `第 ${r} 行${any ? "剩下的列都试过了" : "每一列都被攻击了，放不下"}。拿掉第 ${r - 1} 行的皇后，换下一列试。`, view(), { at: "back", kind: "warn", ...f() });
    };
    dfs(0);
    snap("完成", `所有摆法都试过了，一共 <b>${res.length}</b> 种。`, view(), { at: "done", kind: "ok", ans: res.map((x) => x.slice()), ...f() });
  },
  points: [
    { t: "对角线的编号", body: "<code>r - c</code> 的范围是 -(n-1) 到 n-1，用集合就不用管负数；用数组的话要加上 n-1 的偏移。" },
    { t: "撤销要和放置成对", body: "放的时候改了 4 个地方（queens 和 3 个集合），回溯时 4 个都要撤销。" },
    { t: "复杂度", body: "最坏是 O(n!)，实际因为剪枝远比这个少。n = 8 时有 92 种摆法。" },
  ],
};
