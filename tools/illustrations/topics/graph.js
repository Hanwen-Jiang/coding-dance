module.exports = {
  slug: "graph", name: "图的表示", kind: "ds", order: 7,
  lede: "图由点和边组成。题目一般给一个边的列表，第一步几乎总是把它变成邻接表：每个点记下和它相连的点，这样「从 u 能走到哪些点」一查就有。网格是一种特殊的图：每个格子和上下左右四个格子相连，用方向数组就能找到邻居，不用真的建图。",
  related: [200, 994, 207],
  sections: [{
    key: "adj", t: "邻接表",
    body: [
      "n 个点编号 0 到 n−1 时，邻接表就是一个长度为 n 的列表，<code>graph[u]</code> 里放 u 的所有邻居。无向边 <code>(u, v)</code> 两个方向都要加；有向边只加 <code>u → v</code>。建表 O(n + m)，m 是边数。",
      "有了邻接表，从起点出发用 DFS 或 BFS 把能到的点都走一遍，就知道两个点之间有没有路。<code>seen</code> 数组记录走过的点，防止在环上转圈。",
      "另一种表示是邻接矩阵 <code>g[u][v]</code>，适合点少边多的稠密图；点多的时候 n² 的空间放不下，所以题目里多用邻接表。",
    ],
    points: [
      { t: "进栈时就标记", body: "放进栈 / 队列的同时就设 <code>seen</code>，同一个点不会被放进去两次。" },
      { t: "点的编号从 1 开始", body: "有的题点是 1 到 n，邻接表开 <code>n + 1</code> 格，或者每个编号减 1。" },
    ],
    codes: [{ t: "邻接表 + DFS", key: "adj", code: `
class Solution:
    def validPath(self, n: int, edges: List[List[int]], source: int, destination: int) -> bool:
        graph = [[] for _ in range(n)]          # graph[u] 是 u 的所有邻居 #@init
        for u, v in edges:                      #@edge
            graph[u].append(v)                  # 无向图：两个方向都要加 #@edge
            graph[v].append(u)                  #@edge
        seen = [False] * n                      #@start
        seen[source] = True                     #@start
        stack = [source]                        #@start
        while stack:
            u = stack.pop()                     #@pop
            if u == destination:                #@found
                return True                     #@found
            for v in graph[u]:                  # 只看和 u 相连的点 #@next
                if not seen[v]:                 #@next
                    seen[v] = True              #@next
                    stack.append(v)             #@next
        return False                            #@done
` }],
    sig: { fn: "validPath", params: ["int", "int[][]", "int", "int"], ret: "bool" },
    call: (a) => [a.n, a.edges, a.source, a.destination],
    cases: [[3, [[0, 1], [1, 2], [2, 0]], 0, 2], [6, [[0, 1], [0, 2], [3, 5], [5, 4], [4, 3]], 0, 5], [1, [], 0, 0]],
    gen: (R) => {
      const n = R.int(4, 7), edges = [], has = new Set();
      for (let k = R.int(n - 2, n + 1), guard = 0; edges.length < k && guard < 100; guard++) {
        const u = R.int(0, n - 1), v = R.int(0, n - 1);
        if (u === v || has.has(`${u},${v}`)) continue;
        has.add(`${u},${v}`); has.add(`${v},${u}`); edges.push([u, v]);
      }
      const source = R.int(0, n - 1), destination = R.int(0, n - 1);
      return { args: { n, edges, source, destination }, note: `n = ${n}, edges = ${R.fmt(edges)}, source = ${source}, destination = ${destination}` };
    },
    demo: {
      legend: [["a", "刚弹出的点"], ["e", "在栈里"], ["c", "走过了"], ["w", "终点"]],
      presets: [
        { label: "走得到", args: { n: 6, edges: [[0, 1], [0, 2], [2, 3], [3, 5], [1, 4]], source: 0, destination: 5 }, note: "n = 6, edges = [[0,1],[0,2],[2,3],[3,5],[1,4]], source = 0, destination = 5", expect: true },
        { label: "走不到", args: { n: 6, edges: [[0, 1], [0, 2], [3, 5], [5, 4], [4, 3]], source: 0, destination: 5 }, note: "n = 6, edges = [[0,1],[0,2],[3,5],[5,4],[4,3]], source = 0, destination = 5", expect: false },
      ],
      build(a, snap) {
        const n = a.n, g = Array.from({ length: n }, () => []), seen = new Array(n).fill(false), st = [];
        const edgeKey = (u, v) => (u < v ? `${u},${v}` : `${v},${u}`);
        const treeEdges = new Set();
        let built = 0, cur = -1, hotEdge = -1, activeEdges = new Set(), freshChips = new Set(), seenCount = 0;
        const view = () => [
          {
            t: "net",
            label: "图",
            nodes: Array.from({ length: n }, (_, i) => ({
              v: i,
              cls: i === cur ? "a" : st.includes(i) ? "e" : seen[i] ? "c" : i === a.destination ? "w" : "",
            })),
            edges: a.edges.map(([u, v], k) => {
              const key = edgeKey(u, v);
              const cls = hotEdge >= 0
                ? (k === hotEdge ? "on draw" : k < built ? "" : "dim")
                : (activeEdges.has(key) ? "on draw" : treeEdges.has(key) ? "on" : "");
              return [u, v, cls];
            }),
          },
          {
            t: "chips",
            label: "邻接表 graph",
            items: g.map((nb, i) => ({ v: `${i}: [${nb.join(", ")}]`, cls: i === cur || freshChips.has(i) ? "a" : "" })),
          },
          {
            t: "chips",
            label: "栈（右边是栈顶）",
            items: st.map((x) => ({ v: x, cls: freshChips.has(x) ? "a" : "e" })),
            empty: "空",
          },
        ];
        snap("开始", `${n} 个点，邻接表里每个点先放一个空列表。`, view(), {
          at: "init",
          facts: [["阶段", "建邻接表"], ["已建边", `0 / ${a.edges.length}`], ["已访问", 0]],
        });
        a.edges.forEach(([u, v], k) => {
          g[u].push(v); g[v].push(u); built = k + 1; hotEdge = k;
          freshChips = new Set([u, v]);
          snap("加边", `边 (${u}, ${v})：把 ${v} 加进 graph[${u}]，把 ${u} 加进 graph[${v}]。`, view(), {
            at: "edge",
            facts: [["当前边", `(${u}, ${v})`], ["已建边", `${built} / ${a.edges.length}`, `${built - 1} / ${a.edges.length}`], ["已访问", 0]],
          });
        });
        hotEdge = -1; freshChips = new Set();
        seen[a.source] = true; seenCount = 1; st.push(a.source);
        snap("出发", `从 ${a.source} 出发：标记走过，放进栈。要找的是 ${a.destination}。`, view(), {
          at: "start",
          facts: [["当前点", a.source], ["已访问", 1, 0], ["栈大小", st.length, 0]],
        });
        let prevCur = a.source;
        while (st.length) {
          const prevSeen = seenCount, prevStLen = st.length;
          cur = st.pop();
          activeEdges = new Set();
          freshChips = new Set();
          if (cur === a.destination) {
            snap("到了", `弹出 ${cur}，就是终点，返回 true。`, view(), {
              at: ["pop", "found"],
              kind: "ok",
              ans: true,
              facts: [["当前点", cur, prevCur], ["已访问", seenCount], ["栈大小", st.length, prevStLen]],
            });
            return;
          }
          const add = g[cur].filter((v) => !seen[v]);
          add.forEach((v) => {
            seen[v] = true; seenCount++; st.push(v);
            const k = edgeKey(cur, v);
            activeEdges.add(k); treeEdges.add(k); freshChips.add(v);
          });
          snap("弹出", `弹出 ${cur}，不是终点。它的邻居是 [${g[cur].join(", ")}]，` + (add.length ? `其中 ${add.join("、")} 没走过，标记后压栈。` : "都走过了。"), view(), {
            at: ["pop", "found", "next"],
            facts: [["当前点", cur, prevCur], ["已访问", seenCount, prevSeen], ["栈大小", st.length, prevStLen]],
          });
          prevCur = cur;
        }
        cur = -1; activeEdges = new Set(); freshChips = new Set();
        snap("走不到", `栈空了，从 ${a.source} 能走到的点都走过了，没有 ${a.destination}，返回 false。`, view(), {
          at: "done",
          kind: "ok",
          ans: false,
          facts: [["当前点", "—", prevCur], ["已访问", seenCount], ["结果", "false"]],
        });
      },
    },
  }, {
    key: "grid", t: "网格：方向数组",
    body: [
      "网格题里格子 <code>(i, j)</code> 的邻居是上下左右四个格子。把四个方向写成数组 <code>[(-1, 0), (1, 0), (0, -1), (0, 1)]</code>，一个循环就能枚举邻居，不用写四遍几乎一样的代码。",
      "邻居可能越界，要先判断 <code>0 &lt;= a &lt; m</code> 且 <code>0 &lt;= b &lt; n</code>。这道题正好利用了越界：一块陆地的某条边如果挨着水或者网格边缘，这条边就是周长的一部分。",
      "需要斜着走时用八个方向；网格上的 DFS / BFS（岛屿数量、腐烂的橘子）也都是这个写法。",
    ],
    points: [
      { t: "m 行 n 列", body: "<code>grid[i][j]</code> 的 i 是行、j 是列。<code>m = len(grid)</code>，<code>n = len(grid[0])</code>。" },
      { t: "也可以数相邻", body: "周长 = 4 × 陆地数 − 2 × 相邻的陆地对数，不用方向数组也能算。" },
    ],
    codes: [{ t: "方向数组", key: "grid", code: `
class Solution:
    def islandPerimeter(self, grid: List[List[int]]) -> int:
        m, n = len(grid), len(grid[0])
        dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]       # 上下左右 #@init
        ans = 0                                         #@init
        for i in range(m):                              #@cell
            for j in range(n):                          #@cell
                if grid[i][j] == 0:                     #@cell
                    continue                            #@cell
                for di, dj in dirs:                     #@dir
                    a, b = i + di, j + dj               # 邻居的坐标 #@dir
                    if not (0 <= a < m and 0 <= b < n) or grid[a][b] == 0:     # 出界或者是水 #@edge
                        ans += 1                        # 这条边是周长 #@edge
        return ans                                      #@done
` }],
    sig: { fn: "islandPerimeter", params: ["int[][]"], ret: "int" },
    call: (a) => [a.grid],
    cases: [[[[0, 1, 0, 0], [1, 1, 1, 0], [0, 1, 0, 0], [1, 1, 0, 0]]], [[[1]]], [[[1, 0]]]],
    gen: (R) => {
      const m = R.int(3, 5), n = R.int(3, 5), grid = Array.from({ length: m }, () => new Array(n).fill(0)), cells = [[R.int(0, m - 1), R.int(0, n - 1)]];
      grid[cells[0][0]][cells[0][1]] = 1;
      for (let k = R.int(2, Math.floor((m * n) / 2)), guard = 0; cells.length < k && guard < 200; guard++) {
        const [i, j] = R.pick(cells), [di, dj] = R.pick([[-1, 0], [1, 0], [0, -1], [0, 1]]), a = i + di, b = j + dj;
        if (a >= 0 && a < m && b >= 0 && b < n && !grid[a][b]) { grid[a][b] = 1; cells.push([a, b]); }
      }
      return { args: { grid }, note: `grid = ${R.fmt(grid)}` };
    },
    demo: {
      legend: [["a", "正在看的陆地"], ["w", "它挨着水或边缘的方向"], ["e", "陆地"], ["c", "数过了"]],
      presets: [{ label: "示例 1", args: { grid: [[0, 1, 0, 0], [1, 1, 1, 0], [0, 1, 0, 0], [1, 1, 0, 0]] }, note: "grid = [[0,1,0,0],[1,1,1,0],[0,1,0,0],[1,1,0,0]]", expect: 16 }],
      build(a, snap) {
        const g = a.grid, m = g.length, n = g[0].length, done = new Set(), contrib = {};
        let ans = 0, ci = -1, cj = -1, open = [];
        const view = (opts = {}) => {
          const prevMap = opts.prevMap || {};
          return [{
            t: "grid",
            label: "网格（1 是陆地，0 是水；数完会显示这块贡献的边数）",
            rows: g.map((row, i) => row.map((v, j) => ({
              v: v ? (contrib[`${i},${j}`] !== undefined ? `+${contrib[`${i},${j}`]}` : 1) : 0,
              ...(prevMap[`${i},${j}`] !== undefined ? { prev: prevMap[`${i},${j}`] } : {}),
              cls: i === ci && j === cj ? "a" : open.some(([x, y]) => x === i && y === j) ? "w" : v ? (done.has(i * n + j) ? "c" : "e") : "",
            }))),
            feeds: (opts.feeds || []).slice(),
          }];
        };
        snap("开始", "四个方向：上、下、左、右。周长先是 0。", view(), {
          at: "init",
          facts: [["当前格子", "—"], ["本块贡献", 0], ["周长", 0]],
        });
        const D = [[-1, 0, "上"], [1, 0, "下"], [0, -1, "左"], [0, 1, "右"]];
        let prevCell = "—", prevSides = 0;
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
          if (!g[i][j]) continue;
          ci = i; cj = j;
          const sides = D.filter(([di, dj]) => { const x = i + di, y = j + dj; return !(x >= 0 && x < m && y >= 0 && y < n) || !g[x][y]; });
          open = sides.map(([di, dj]) => [i + di, j + dj]).filter(([x, y]) => x >= 0 && x < m && y >= 0 && y < n);
          const feeds = open.map(([x, y]) => ({ from: [i, j], to: [x, y], win: true, label: "+1" }));
          const prevAns = ans;
          contrib[`${i},${j}`] = sides.length;
          ans += sides.length;
          const curCell = `(${i}, ${j})`;
          snap("看一块陆地", `(${i}, ${j}) 是陆地。看四个方向：${sides.length ? sides.map((d) => d[2]).join("、") + " 挨着水或边缘" : "四面都是陆地"}，周长加 ${sides.length}。`, view({ prevMap: { [`${i},${j}`]: 1 }, feeds }), {
            at: ["cell", "dir", "edge"],
            facts: [["当前格子", curCell, prevCell], ["本块贡献", `+${sides.length}`, prevSides], ["周长", ans, prevAns]],
          });
          prevCell = curCell; prevSides = `+${sides.length}`;
          done.add(i * n + j);
        }
        ci = cj = -1; open = [];
        snap("完成", `周长是 ${ans}。`, view(), {
          at: "done",
          kind: "ok",
          ans,
          facts: [["当前格子", "完成", prevCell], ["总周长", ans], ["结果", ans]],
        });
      },
    },
  }],
};
