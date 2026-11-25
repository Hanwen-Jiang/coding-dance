module.exports = {
  id: 200, name: "岛屿数量", title: "岛屿数量图解", level: "中等", topic: "图论",
  h1: "岛屿数量，一步一步看",
  lede: "扫到一块没数过的陆地就 +1，然后立刻把这整座岛淹掉，后面再扫到它的格子就直接跳过。",
  hints: [
    { t: "换个说法看题目", body: ["「数岛屿」其实就是「数有几块互相连通的陆地」。", "想象你从左上角开始，一格一格往右、往下扫。什么时候答案应该 +1？"] },
    { t: "怎么避免重复计数", body: ["扫到一块<strong>还没被数过</strong>的陆地，答案就 +1。", "同一座岛有很多格子，之后还会扫到它们。所以 +1 之后，要<strong>立刻把这座岛的所有格子都做上记号</strong>（比如直接改成 <code>'0'</code>，相当于把岛「淹掉」），以后扫到就直接跳过。"] },
    { t: "怎么找出整座岛", body: ["从刚发现的格子出发，往上、下、左、右四个方向扩散：遇到陆地就做记号并继续扩散，遇到水或者走出边界就停。", "这就是 <strong>DFS</strong>（递归或用栈）或 <strong>BFS</strong>（用队列），两种都能过。"] },
  ],
  codes: [{ t: "标准解法：DFS 淹没整座岛", code: `
class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        m, n = len(grid), len(grid[0])      #@init

        def sink(i, j):
            if not (0 <= i < m and 0 <= j < n) or grid[i][j] != '1':
                return                      # 越界或不是陆地
            grid[i][j] = '0'                # 先做记号，再扩散 #@mark
            sink(i - 1, j)                  #@spread
            sink(i + 1, j)                  #@spread
            sink(i, j - 1)                  #@spread
            sink(i, j + 1)                  #@spread

        count = 0                           #@init
        for i in range(m):                  #@scan
            for j in range(n):              #@scan
                if grid[i][j] == '1':       #@found
                    count += 1              #@found
                    sink(i, j)              #@found
        return count                        #@done
` }, { t: "简洁写法：sink 顺便返回 1", kind: "elegant", note: "让 sink 在淹掉一座新岛时返回 1，否则返回 0，答案就是对所有格子求和。", code: `
class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        def sink(i, j):
            if 0 <= i < len(grid) and 0 <= j < len(grid[0]) and grid[i][j] == '1':
                grid[i][j] = '0'
                for x, y in (i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1):
                    sink(x, y)
                return 1
            return 0
        return sum(sink(i, j) for i in range(len(grid)) for j in range(len(grid[0])))
` }, { t: "另一种写法：BFS", key: "bfs", note: "递归太深担心爆栈时，用队列一圈一圈往外扩。入队时就做记号，避免同一个格子重复入队。", code: `
class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        m, n, count = len(grid), len(grid[0]), 0    #@init
        for i in range(m):                          #@scan
            for j in range(n):                      #@scan
                if grid[i][j] != '1':
                    continue
                count += 1                          #@found
                grid[i][j] = '0'                    #@found
                q = deque([(i, j)])                 #@found
                while q:
                    x, y = q.popleft()              #@pop
                    for a, b in (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1):    #@expand
                        if 0 <= a < m and 0 <= b < n and grid[a][b] == '1':     #@expand
                            grid[a][b] = '0'    # 入队时就做记号 #@expand
                            q.append((a, b))    #@expand
        return count                                #@done
` }, { t: "另一种写法：用栈模拟 DFS", key: "stack", note: "把 BFS 的队列换成栈（<code>popleft</code> 换成 <code>pop</code>），就是不用递归的 DFS。", code: `
class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        m, n, count = len(grid), len(grid[0]), 0    #@init
        for i in range(m):                          #@scan
            for j in range(n):                      #@scan
                if grid[i][j] != '1':
                    continue
                count += 1                          #@found
                grid[i][j] = '0'                    #@found
                stack = [(i, j)]                    #@found
                while stack:
                    x, y = stack.pop()              #@pop
                    for a, b in (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1):    #@expand
                        if 0 <= a < m and 0 <= b < n and grid[a][b] == '1':     #@expand
                            grid[a][b] = '0'    # 入栈时就做记号 #@expand
                            stack.append((a, b))    #@expand
        return count                                #@done
` }],
  sig: { fn: "numIslands", params: ["char[][]"], ret: "int" },
  call: (a) => [a.grid.map((r) => r.split(""))],
  cases: [[[["0"]]], [[["1"]]]],
  pytest: `
s = Solution()
g = lambda rows: [list(r) for r in rows]
assert s.numIslands(g(["11110","11010","11000","00000"])) == 1
assert s.numIslands(g(["11000","11000","00100","00011"])) == 3
assert s.numIslands(g(["0"])) == 0
assert s.numIslands(g(["1"])) == 1
assert s.numIslands(g(["101","010","101"])) == 5
`,
  demoTitle: "海图演示",
  method: "递归 sink",
  methodNote: "和标准解法一样：sink 淹掉当前格子，再按上、下、左、右的顺序递归。越界、是水或已经淹掉的方向，sink 一进去就返回，演示里直接跳过。",
  legend: [["d", "水 0"], ["", "还没淹的陆地 1"], ["e", "在递归路径上，还没返回"], ["a", "正在执行的 sink"], ["c", "已经淹掉（改成 0，颜色区分不同岛）"]],
  presets: [
    { label: "示例 1", args: { grid: ["11110", "11010", "11000", "00000"] }, note: 'grid = ["11110","11010","11000","00000"]', expect: 1 },
    { label: "示例 2", args: { grid: ["11000", "11000", "00100", "00011"] }, note: 'grid = ["11000","11000","00100","00011"]', expect: 3 },
    { label: "斜着不算相连", args: { grid: ["101", "010", "101"] }, note: 'grid = ["101","010","101"]', expect: 5 },
  ],
  build(a, snap) {
    const g = a.grid.map((r) => r.split("")), m = g.length, n = g[0].length;
    const mark = g.map((r) => r.map(() => 0)); // 0 还没淹，k 表示属于第 k 座岛
    const COL = ["c", "g", "w"], DIR = [[-1, 0, "上"], [1, 0, "下"], [0, -1, "左"], [0, 1, "右"]];
    let count = 0;
    const calls = []; // 递归调用栈：[i, j]
    const onPath = (i, j) => calls.some(([x, y]) => x === i && y === j);
    const view = (opts = {}) => {
      const top = calls[calls.length - 1];
      const prevMap = opts.prevMap || {};
      return [
        {
          t: "grid",
          label: "grid（发现陆地就淹成 0，颜色区分不同的岛）",
          rows: g.map((r, i) => r.map((v, j) => {
            const k = mark[i][j];
            const cls = top && top[0] === i && top[1] === j ? "a" : onPath(i, j) ? "e" : k ? COL[(k - 1) % 3] : v === "0" ? "d" : "";
            return {
              v: k ? "0" : v,
              ...(prevMap[`${i},${j}`] !== undefined ? { prev: prevMap[`${i},${j}`] } : {}),
              cls,
            };
          })),
          feeds: (opts.feeds || []).slice(),
        },
        { t: "chips", label: "递归调用栈（右边是正在执行的那一层）", items: calls.map(([x, y], t) => ({ v: `sink(${x},${y})`, cls: t === calls.length - 1 ? "a" : "e" })), empty: "空：回到外面的两层循环" },
      ];
    };
    const sink = (i, j, dir, parent) => {
      const prevDepth = calls.length;
      mark[i][j] = count;
      calls.push([i, j]);
      const prevMap = { [`${i},${j}`]: "1" };
      if (dir) {
        snap(
          "递归进入",
          `往${dir}走到 (${i},${j})：是陆地，淹成 0，再从它出发按上、下、左、右递归。`,
          view({ prevMap, feeds: [{ from: parent, to: [i, j], win: true, label: dir }] }),
          { at: "mark", facts: [["岛屿数", count], ["递归深度", calls.length, prevDepth], ["当前格子", `(${i},${j})`]] },
        );
      } else {
        snap(
          "发现新岛",
          `(${i},${j}) 是还没淹过的陆地，岛屿数 +1，变成 <b>${count}</b>。调用 sink(${i},${j})：先淹成 0，再按上、下、左、右递归。`,
          view({ prevMap }),
          { at: ["found", "mark"], facts: [["岛屿数", count, count - 1], ["递归深度", calls.length, prevDepth], ["当前格子", `(${i},${j})`]] },
        );
      }
      for (const [di, dj, dn] of DIR) {
        const p = i + di, q = j + dj;
        if (p < 0 || q < 0 || p >= m || q >= n || g[p][q] !== "1" || mark[p][q]) continue;
        sink(p, q, dn, [i, j]);
        const rest = DIR.slice(DIR.findIndex((d) => d[2] === dn) + 1).map((d) => d[2]);
        snap(
          "返回",
          `sink(${p},${q}) 这一支淹完了，返回到 sink(${i},${j})。` + (rest.length ? `接着试它的「${rest.join("、")}」。` : "它四个方向都试过了。"),
          view(),
          { at: "spread", facts: [["岛屿数", count], ["递归深度", calls.length, calls.length + 1], ["当前格子", `(${i},${j})`]] },
        );
      }
      calls.pop();
    };
    snap("开始", `从左上角开始一格一格扫。扫到没淹过的陆地，岛屿数就 +1，再调用 sink 把整座岛淹掉。`, view(), { at: "init", facts: [["岛屿数", 0], ["递归深度", 0], ["网格", `${m}×${n}`]] });
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
      if (g[i][j] !== "1" || mark[i][j]) continue;
      count++;
      sink(i, j, null, null);
      snap("淹完", `sink(${i},${j}) 返回了，调用栈空了，第 ${count} 座岛整个淹掉。接着往后扫，碰到淹过的格子直接跳过。`, view(), { at: "scan", facts: [["岛屿数", count], ["递归深度", 0, 1], ["状态", `第 ${count} 岛完成`]] });
    }
    snap("完成", `所有格子都扫完了，一共 <b>${count}</b> 座岛。`, view(), { kind: "ok", ans: count, at: "done", facts: [["岛屿数", count], ["递归深度", 0], ["结果", count]] });
  },
  alts: [{
    t: "BFS 队列",
    code: "bfs",
    note: "从新岛的第一格出发，用队列一圈一圈往外扩：出队一个格子，把它四周没淹的陆地做上记号放进队尾。离起点近的格子总是先被淹。",
    legend: [["d", "水 0"], ["", "还没淹的陆地 1"], ["e", "在队列里排队"], ["a", "刚出队，正在看四周"], ["c", "已经淹掉（改成 0，颜色区分不同岛）"]],
    build(a, snap) {
      const g = a.grid.map((r) => r.split("")), m = g.length, n = g[0].length;
      const mark = g.map((r) => r.map(() => 0)), ring = g.map((r) => r.map(() => 0));
      const COL = ["c", "g", "w"], DIR = [[-1, 0, "上"], [1, 0, "下"], [0, -1, "左"], [0, 1, "右"]];
      let count = 0, q = [], cur = null;
      const inQ = (i, j) => q.some(([x, y]) => x === i && y === j);
      const view = (opts = {}) => {
        const prevMap = opts.prevMap || {};
        return [
          {
            t: "grid",
            label: "grid（发现陆地就淹成 0，颜色区分不同的岛）",
            rows: g.map((r, i) => r.map((v, j) => {
              const k = mark[i][j];
              const cls = cur && cur[0] === i && cur[1] === j ? "a" : inQ(i, j) ? "e" : k ? COL[(k - 1) % 3] : v === "0" ? "d" : "";
              return {
                v: k ? "0" : v,
                ...(prevMap[`${i},${j}`] !== undefined ? { prev: prevMap[`${i},${j}`] } : {}),
                cls,
              };
            })),
            feeds: (opts.feeds || []).slice(),
          },
          { t: "chips", label: "队列（左边是队头，先出队）", items: q.map(([x, y]) => `(${x},${y}) 第${ring[x][y]}圈`), empty: "空" },
        ];
      };
      snap("开始", `从左上角开始一格一格扫。扫到没淹过的陆地，岛屿数就 +1，再用队列把整座岛淹掉。`, view(), { at: "init", facts: [["岛屿数", 0], ["队列长度", 0], ["网格", `${m}×${n}`]] });
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
        if (g[i][j] !== "1" || mark[i][j]) continue;
        count++;
        mark[i][j] = count;
        q = [[i, j]];
        snap(
          "发现新岛",
          `(${i},${j}) 是还没淹过的陆地，岛屿数 +1，变成 <b>${count}</b>。先淹成 0 放进队列，它是第 0 圈。`,
          view({ prevMap: { [`${i},${j}`]: "1" } }),
          { at: "found", facts: [["岛屿数", count, count - 1], ["队列长度", 1, 0], ["当前圈数", 0]] },
        );
        while (q.length) {
          const prevQ = q.length;
          cur = q.shift();
          const [x, y] = cur, added = [], prevMap = {}, feeds = [];
          for (const [di, dj, dn] of DIR) {
            const p = x + di, s = y + dj;
            if (p < 0 || s < 0 || p >= m || s >= n || g[p][s] !== "1" || mark[p][s]) continue;
            mark[p][s] = count;
            ring[p][s] = ring[x][y] + 1;
            q.push([p, s]);
            added.push(`(${p},${s})`);
            prevMap[`${p},${s}`] = "1";
            feeds.push({ from: [x, y], to: [p, s], win: true, label: dn });
          }
          snap(
            "出队扩散",
            `队头 (${x},${y}) 出队（第 ${ring[x][y]} 圈），看它上下左右。` + (added.length ? `${added.join("、")} 是陆地，淹成 0 排到队尾，它们是第 ${ring[x][y] + 1} 圈。` : "四周没有新的陆地。"),
            view({ prevMap, feeds }),
            { at: ["pop", "expand"], facts: [["岛屿数", count], ["队列长度", q.length, prevQ], ["当前圈数", ring[x][y]]] },
          );
        }
        cur = null;
        snap("淹完", `队列空了，第 ${count} 座岛整个淹掉。接着往后扫，碰到淹过的格子直接跳过。`, view(), { at: "scan", facts: [["岛屿数", count], ["队列长度", 0], ["状态", `第 ${count} 岛完成`]] });
      }
      snap("完成", `所有格子都扫完了，一共 <b>${count}</b> 座岛。`, view(), { kind: "ok", ans: count, at: "done", facts: [["岛屿数", count], ["队列长度", 0], ["结果", count]] });
    },
  }, {
    t: "栈模拟 DFS",
    code: "stack",
    note: "和 BFS 的写法一样，只是把队列换成栈：每次弹出最后放进去的格子，所以会先沿着一个方向钻到底。入栈时就做记号。",
    legend: [["d", "水 0"], ["", "还没淹的陆地 1"], ["e", "在栈里等着扩散"], ["a", "刚弹出，正在看四周"], ["c", "已经淹掉（改成 0，颜色区分不同岛）"]],
    build(a, snap) {
      const g = a.grid.map((r) => r.split("")), m = g.length, n = g[0].length;
      const mark = g.map((r) => r.map(() => 0)); // 0 还没淹，k 表示属于第 k 座岛
      const COL = ["c", "g", "w"], DIR = [[-1, 0, "上"], [1, 0, "下"], [0, -1, "左"], [0, 1, "右"]];
      let count = 0, stack = [], cur = null;
      const inStack = (i, j) => stack.some(([x, y]) => x === i && y === j);
      const view = (opts = {}) => {
        const prevMap = opts.prevMap || {};
        return [
          {
            t: "grid",
            label: "grid（发现陆地就淹成 0，颜色区分不同的岛）",
            rows: g.map((r, i) => r.map((v, j) => {
              const k = mark[i][j];
              const cls = cur && cur[0] === i && cur[1] === j ? "a" : inStack(i, j) ? "e" : k ? COL[(k - 1) % 3] : v === "0" ? "d" : "";
              return {
                v: k ? "0" : v,
                ...(prevMap[`${i},${j}`] !== undefined ? { prev: prevMap[`${i},${j}`] } : {}),
                cls,
              };
            })),
            feeds: (opts.feeds || []).slice(),
          },
          { t: "chips", label: "栈（右边是栈顶）", items: stack.map(([x, y]) => `(${x},${y})`), empty: "空" },
        ];
      };
      snap("开始", `从左上角开始一格一格扫。扫到没淹过的陆地，岛屿数就 +1，再把整座岛淹掉。`, view(), { at: "init", facts: [["岛屿数", 0], ["栈大小", 0], ["网格", `${m}×${n}`]] });
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
        if (g[i][j] !== "1" || mark[i][j]) continue;
        count++;
        mark[i][j] = count;
        stack = [[i, j]];
        snap(
          "发现新岛",
          `(${i},${j}) 是还没淹过的陆地，岛屿数 +1，变成 <b>${count}</b>。先淹成 0 放进栈里，从这里开始把整座岛淹掉。`,
          view({ prevMap: { [`${i},${j}`]: "1" } }),
          { at: "found", facts: [["岛屿数", count, count - 1], ["栈大小", 1, 0], ["当前格子", `(${i},${j})`]] },
        );
        while (stack.length) {
          const prevS = stack.length;
          cur = stack.pop();
          const [x, y] = cur, added = [], prevMap = {}, feeds = [];
          for (const [di, dj, dn] of DIR) {
            const p = x + di, q = y + dj;
            if (p < 0 || q < 0 || p >= m || q >= n || g[p][q] !== "1" || mark[p][q]) continue;
            mark[p][q] = count;
            stack.push([p, q]);
            added.push(`(${p},${q})`);
            prevMap[`${p},${q}`] = "1";
            feeds.push({ from: [x, y], to: [p, q], win: true, label: dn });
          }
          snap(
            "扩散",
            `弹出 (${x},${y})，看它上下左右。` + (added.length ? `${added.join("、")} 是陆地，淹成 0 放进栈里。` : "四周没有新的陆地。"),
            view({ prevMap, feeds }),
            { at: ["pop", "expand"], facts: [["岛屿数", count], ["栈大小", stack.length, prevS], ["当前格子", `(${x},${y})`]] },
          );
        }
        cur = null;
        snap("淹完", `栈空了，第 ${count} 座岛整个淹掉了。接着往后扫，碰到做过记号的格子直接跳过。`, view(), { at: "scan", facts: [["岛屿数", count], ["栈大小", 0], ["状态", `第 ${count} 岛完成`]] });
      }
      snap("完成", `所有格子都扫完了，一共 <b>${count}</b> 座岛。`, view(), { kind: "ok", ans: count, at: "done", facts: [["岛屿数", count], ["栈大小", 0], ["结果", count]] });
    },
  }],
  points: [
    { t: "先判断再递归", body: "进 <code>sink</code> 第一件事就是判断越界和是不是陆地，四个方向就不用各写一遍判断。" },
    { t: "先做记号再扩散", body: "记号要在扩散之前做，否则两个相邻格子会互相跳来跳去，死循环。" },
    { t: "格子是字符", body: "<code>grid</code> 里存的是字符 <code>'1'</code> 和 <code>'0'</code>，不是数字。" },
    { t: "复杂度", body: "每个格子最多被访问常数次，时间 O(m·n)；最坏情况下递归深度也是 O(m·n)。" },
  ],
};
