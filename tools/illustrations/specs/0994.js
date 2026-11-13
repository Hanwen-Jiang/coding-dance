module.exports = {
  id: 994, name: "腐烂的橘子", title: "腐烂的橘子图解", level: "中等", topic: "图论",
  h1: "腐烂的橘子，所有烂橘子同时往外扩",
  lede: "每过一分钟，所有烂橘子同时让上下左右的新鲜橘子变烂。这是多源 BFS：一开始把所有烂橘子一起放进队列，一层就是一分钟。最后还有新鲜橘子没烂，就返回 -1。",
  hints: [
    { t: "多个起点同时出发", body: ["不是从一个烂橘子开始，而是所有烂橘子同一时刻开始扩散。", "把它们一起放进队列作为第 0 层。"] },
    { t: "一层就是一分钟", body: ["每次把当前队列里的所有橘子处理完，才算过了一分钟。新变烂的橘子进队，留到下一分钟处理。"] },
    { t: "什么时候返回 -1", body: ["先数出新鲜橘子的个数 <code>fresh</code>，每烂一个减一。", "队列空了 <code>fresh</code> 还大于 0，说明有橘子被空格隔开了，永远烂不了。"] },
  ],
  codes: [{ t: "标准解法：多源 BFS", code: `
class Solution:
    def orangesRotting(self, grid: List[List[int]]) -> int:
        m, n = len(grid), len(grid[0])
        q = deque((i, j) for i in range(m) for j in range(n) if grid[i][j] == 2)
        fresh = sum(row.count(1) for row in grid)
        minutes = 0
        while q and fresh:
            minutes += 1
            for _ in range(len(q)):         # 这一分钟里所有烂橘子同时扩散
                i, j = q.popleft()
                for x, y in (i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1):
                    if 0 <= x < m and 0 <= y < n and grid[x][y] == 1:
                        grid[x][y] = 2
                        fresh -= 1
                        q.append((x, y))
        return -1 if fresh else minutes
` }, { t: "简洁写法：用集合按轮扩散", kind: "elegant", note: "rotten 只保留这一分钟新烂的橘子，就是 BFS 的一层。", code: `
class Solution:
    def orangesRotting(self, grid: List[List[int]]) -> int:
        cells = {(i, j): v for i, row in enumerate(grid) for j, v in enumerate(row)}
        fresh = {p for p, v in cells.items() if v == 1}
        rotten = {p for p, v in cells.items() if v == 2}
        minutes = 0
        while fresh:
            rotten = {(x, y) for i, j in rotten
                      for x, y in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1))
                      if (x, y) in fresh}
            if not rotten:
                return -1                   # 这一分钟没有新烂的，剩下的永远烂不了
            fresh -= rotten
            minutes += 1
        return minutes
` }],
  pytest: `
s = Solution()
assert s.orangesRotting([[2,1,1],[1,1,0],[0,1,1]]) == 4
assert s.orangesRotting([[2,1,1],[0,1,1],[1,0,1]]) == -1
assert s.orangesRotting([[0,2]]) == 0
assert s.orangesRotting([[0]]) == 0
assert s.orangesRotting([[2,1,1],[1,1,1],[0,1,2]]) == 2
`,
  legend: [["b", "烂橘子 2"], ["w", "这一分钟刚烂的"], ["k", "新鲜橘子 1"], ["d", "空格 0"]],
  presets: [
    { label: "示例 1", args: { grid: [[2, 1, 1], [1, 1, 0], [0, 1, 1]] }, note: "grid = [[2,1,1],[1,1,0],[0,1,1]]", expect: 4 },
    { label: "烂不完", args: { grid: [[2, 1, 1], [0, 1, 1], [1, 0, 1]] }, note: "grid = [[2,1,1],[0,1,1],[1,0,1]]", expect: -1 },
    { label: "两个起点", args: { grid: [[2, 1, 1], [1, 1, 1], [0, 1, 2]] }, note: "grid = [[2,1,1],[1,1,1],[0,1,2]]", expect: 2 },
  ],
  build(a, snap) {
    const g = a.grid.map((r) => r.slice()), m = g.length, n = g[0].length;
    let q = [], fresh = 0, minutes = 0, fresh2 = [];
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { if (g[i][j] === 2) q.push([i, j]); if (g[i][j] === 1) fresh++; }
    const sym = ["", 1, 2];
    const view = () => [{ t: "grid", label: "grid", rows: g.map((r, i) => r.map((v, j) => ({ v: sym[v], cls: v === 0 ? "d" : v === 1 ? "k" : fresh2.some(([x, y]) => x === i && y === j) ? "w" : "b" }))) }];
    const f = () => ({ facts: [["分钟", minutes], ["新鲜", fresh]] });
    snap("开始", `一开始有 ${q.length} 个烂橘子、${fresh} 个新鲜橘子。所有烂橘子一起放进队列。`, view(), f());
    while (q.length && fresh) {
      minutes++; const nq = []; fresh2 = [];
      for (const [i, j] of q) for (const [x, y] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (x >= 0 && y >= 0 && x < m && y < n && g[x][y] === 1) { g[x][y] = 2; fresh--; nq.push([x, y]); fresh2.push([x, y]); }
      }
      q = nq;
      snap(`第 ${minutes} 分钟`, nq.length ? `上一分钟的烂橘子同时向四周扩散，又烂了 <b>${nq.length}</b> 个。还剩 ${fresh} 个新鲜的。` : "没有新的橘子变烂。", view(), f());
    }
    const ans = fresh ? -1 : minutes;
    fresh2 = [];
    snap("完成", fresh ? `队列空了，还有 ${fresh} 个新鲜橘子被空格隔开，永远烂不了，返回 <b>-1</b>。` : `所有橘子都烂了，用了 <b>${minutes}</b> 分钟。`, view(), { kind: fresh ? "warn" : "ok", ans, ...f() });
  },
  points: [
    { t: "循环条件带上 fresh", body: "<code>while q and fresh</code>：新鲜橘子已经没了就停，否则最后一层还会多算一分钟。" },
    { t: "没有新鲜橘子时返回 0", body: "一开始就没有新鲜橘子，不需要等待，答案是 0。" },
    { t: "复杂度", body: "每个格子最多入队一次，时间 O(m·n)，空间 O(m·n)。" },
  ],
};
