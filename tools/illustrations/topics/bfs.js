module.exports = {
  slug: "bfs", name: "广度优先搜索 BFS", kind: "algo", order: 5,
  lede: "BFS 从起点出发一圈一圈往外扩：先走完所有 1 步能到的点，再走 2 步能到的……用队列就能保证这个顺序。所以在每步代价相同的图上，BFS 第一次走到某个点时，走的就是最短的路。",
  related: [102, 199, 994, 200, 279],
  sections: [{
    key: "shortest", t: "最短步数",
    body: [
      "迷宫里每走一格算一步，问最少几步走到出口。把入口放进队列，每次从队头取出一个格子，把它四周没走过的空格子放进队尾，步数加一。",
      "队列先进先出，所以出队的顺序就是按步数从小到大的：步数为 d 的格子全部出队之前，步数为 d + 1 的格子只会排在后面。于是<b>第一次</b>碰到出口，步数就是最少的，直接返回。",
      "<b>入队时就标记</b>走过（这里直接把格子改成墙），同一个格子不会进队两次，每个格子只处理一次，O(m·n)。",
    ],
    points: [
      { t: "为什么不用 DFS", body: "DFS 一条路走到底，先找到的出口不一定最近，要把所有路都走完才知道最短。" },
      { t: "步数跟着格子走", body: "队列里存 <code>(行, 列, 步数)</code>；也可以每轮处理一整层，用一个变量记层数。" },
    ],
    codes: [{ t: "队列 + 入队时标记", key: "shortest", code: `
class Solution:
    def nearestExit(self, maze: List[List[str]], entrance: List[int]) -> int:
        m, n = len(maze), len(maze[0])
        q = deque([(entrance[0], entrance[1], 0)])  # (行, 列, 走了几步) #@init
        maze[entrance[0]][entrance[1]] = "+"    # 走过的格子标成墙，不再走 #@init
        while q:
            i, j, d = q.popleft()               #@pop
            for a, b in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1)):    #@next
                if 0 <= a < m and 0 <= b < n and maze[a][b] == ".":    #@next
                    if a in (0, m - 1) or b in (0, n - 1):  # 到了边上：就是出口 #@exit
                        return d + 1            #@exit
                    maze[a][b] = "+"            # 入队时就标记 #@push
                    q.append((a, b, d + 1))     #@push
        return -1                               #@done
` }],
    sig: { fn: "nearestExit", params: ["char[][]", "int[]"], ret: "int" },
    call: (a) => [a.maze, a.entrance],
    cases: [[[["+", "+", ".", "+"], [".", ".", ".", "+"], ["+", "+", "+", "."]], [1, 2]], [[["+", "+", "+"], [".", ".", "."], ["+", "+", "+"]], [1, 0]], [[[".", "+"]], [0, 0]], [[["."]], [0, 0]]],
    gen: (R) => {
      const m = R.int(3, 6), n = R.int(3, 6), maze = Array.from({ length: m }, () => Array.from({ length: n }, () => (R.chance(0.3) ? "+" : ".")));
      const ei = R.int(0, m - 1), ej = R.int(0, n - 1);
      maze[ei][ej] = ".";
      return { args: { maze, entrance: [ei, ej] }, note: `maze = ${R.fmt(maze)}, entrance = [${ei}, ${ej}]` };
    },
    demo: {
      legend: [["a", "刚出队的格子"], ["e", "在队列里"], ["k", "走过了"], ["w", "边上的空格：出口"], ["d", "墙"], ["c", "找到的出口"]],
      presets: [
        { label: "示例 1", args: { maze: [["+", "+", ".", "+"], [".", ".", ".", "+"], ["+", "+", "+", "."]], entrance: [1, 2] }, note: 'maze = [["+","+",".","+"],[".",".",".","+"],["+","+","+","."]], entrance = [1,2]', expect: 1 },
        { label: "绕远路", args: { maze: [["+", "+", "+", "+", "+"], ["+", ".", ".", ".", "+"], ["+", ".", "+", ".", "+"], ["+", ".", "+", ".", "."], ["+", "+", "+", "+", "+"]], entrance: [3, 1] }, note: "入口在 (3, 1)，唯一的出口在 (3, 4)", expect: 7 },
      ],
      build(a, snap) {
        const orig = a.maze, m = orig.length, n = orig[0].length, [si, sj] = a.entrance;
        const dist = orig.map((r) => r.map(() => null)), q = [[si, sj]];
        dist[si][sj] = 0;
        let cur = null, found = null;
        const edge = (i, j) => i === 0 || j === 0 || i === m - 1 || j === n - 1;
        const view = () => [
          { t: "grid", label: "迷宫（格子里是走到它的步数）", rows: orig.map((r, i) => r.map((c, j) => ({ v: c === "+" ? "" : dist[i][j] ?? "", cls: found && found[0] === i && found[1] === j ? "c" : cur && cur[0] === i && cur[1] === j ? "a" : c === "+" ? "d" : q.some(([x, y]) => x === i && y === j) ? "e" : dist[i][j] !== null ? "k" : edge(i, j) ? "w" : "" }))) },
          { t: "chips", label: "队列（左边先出）", items: q.map(([x, y]) => `(${x}, ${y}) ${dist[x][y]} 步`), empty: "空" },
        ];
        snap("开始", `入口 (${si}, ${sj}) 放进队列，步数 0。把它标记成走过（入口本身不算出口）。`, view(), { at: "init" });
        while (q.length) {
          cur = q.shift();
          const [i, j] = cur, d = dist[i][j], add = [];
          for (const [x, y] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
            if (x < 0 || x >= m || y < 0 || y >= n || orig[x][y] === "+" || dist[x][y] !== null) continue;
            dist[x][y] = d + 1;
            if (edge(x, y)) { found = [x, y]; snap("找到出口", `取出 (${i}, ${j})，${d} 步。它的邻居 (${x}, ${y}) 是边上的空格，就是出口。BFS 第一次碰到出口，${d + 1} 步就是最少的。`, view(), { at: ["pop", "next", "exit"], kind: "ok", ans: d + 1 }); return; }
            q.push([x, y]); add.push(`(${x}, ${y})`);
          }
          snap("出队", `取出 (${i}, ${j})，${d} 步。` + (add.length ? `它旁边没走过的空格 ${add.join("、")} 标记成走过，步数 ${d + 1}，放到队尾。` : "它旁边没有能走的新格子。"), view(), { at: add.length ? ["pop", "next", "push"] : ["pop", "next"] });
        }
        cur = null;
        snap("走不出去", "队列空了，能走到的格子都走过了，没有碰到出口，返回 -1。", view(), { at: "done", kind: "ok", ans: -1 });
      },
    },
  }, {
    key: "multi", t: "多源 BFS",
    body: [
      "求每个格子到<b>最近的 0</b> 的距离。如果从每个 1 出发各做一次 BFS，要 O((m·n)²)。反过来想：把<b>所有的 0 同时</b>放进队列当起点，一起往外扩。",
      "这就像在每个 0 上同时滴一滴墨水：第 1 圈染到的格子距离都是 1，第 2 圈是 2……一个格子第一次被染到，就是被离它最近的那个 0 染到的。整个网格只走一遍，O(m·n)。",
      "「腐烂的橘子」（994）是一样的：所有烂橘子同时作为起点，一圈一圈往外传染。",
    ],
    points: [
      { t: "距离数组兼做标记", body: "初始化成 -1 表示还没走到，走到时直接写上距离，不用再开一个 visited 数组。" },
      { t: "距离从邻居那里来", body: "<code>dist[a][b] = dist[i][j] + 1</code>：每一圈都比上一圈多 1。" },
    ],
    codes: [{ t: "所有起点一起入队", key: "multi", code: `
class Solution:
    def updateMatrix(self, mat: List[List[int]]) -> List[List[int]]:
        m, n = len(mat), len(mat[0])
        dist = [[-1] * n for _ in range(m)]     # -1 表示还没走到 #@init
        q = deque()                             #@init
        for i in range(m):                      #@seed
            for j in range(n):                  #@seed
                if mat[i][j] == 0:              # 所有的 0 同时作为起点 #@seed
                    dist[i][j] = 0              #@seed
                    q.append((i, j))            #@seed
        while q:
            i, j = q.popleft()                  #@pop
            for a, b in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1)):    #@next
                if 0 <= a < m and 0 <= b < n and dist[a][b] == -1:     #@next
                    dist[a][b] = dist[i][j] + 1     # 第一次走到就是最近的距离 #@next
                    q.append((a, b))            #@next
        return dist                             #@done
` }],
    sig: { fn: "updateMatrix", params: ["int[][]"], ret: "int[][]" },
    call: (a) => [a.mat],
    cases: [[[[0, 0, 0], [0, 1, 0], [0, 0, 0]]], [[[0, 0, 0], [0, 1, 0], [1, 1, 1]]], [[[0]]], [[[1, 1, 0, 1, 1]]]],
    gen: (R) => {
      const m = R.int(2, 5), n = R.int(2, 5), mat = Array.from({ length: m }, () => Array.from({ length: n }, () => (R.chance(0.25) ? 0 : 1)));
      mat[R.int(0, m - 1)][R.int(0, n - 1)] = 0;
      return { args: { mat }, note: `mat = ${R.fmt(mat)}` };
    },
    demo: {
      legend: [["c", "0：起点"], ["a", "这一圈刚算出距离的格子"], ["k", "已经算好"]],
      presets: [{ label: "示例 2", args: { mat: [[0, 0, 0], [0, 1, 0], [1, 1, 1]] }, note: "mat = [[0,0,0],[0,1,0],[1,1,1]]", expect: [[0, 0, 0], [0, 1, 0], [1, 2, 1]] }, { label: "一个 0", args: { mat: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 0, 1, 1], [1, 1, 1, 1]] }, note: "mat = [[1,1,1,1],[1,1,1,1],[1,0,1,1],[1,1,1,1]]", expect: [[3, 2, 3, 4], [2, 1, 2, 3], [1, 0, 1, 2], [2, 1, 2, 3]] }],
      build(a, snap) {
        const mat = a.mat, m = mat.length, n = mat[0].length, dist = mat.map((r) => r.map(() => -1));
        let q = [], fresh = [];
        const view = () => [{ t: "grid", label: "dist（空白是还没走到）", rows: dist.map((r, i) => r.map((d, j) => ({ v: d < 0 ? "" : d, cls: fresh.some(([x, y]) => x === i && y === j) ? "a" : d === 0 ? "c" : d > 0 ? "k" : "" }))) }];
        snap("开始", "dist 全部是 -1（还没走到）。", view(), { at: "init" });
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (mat[i][j] === 0) { dist[i][j] = 0; q.push([i, j]); }
        snap("所有的 0 入队", `一共 ${q.length} 个 0，距离都是 0，同时放进队列。`, view(), { at: "seed" });
        for (let d = 1; q.length; d++) {
          const next = [];
          for (const [i, j] of q) for (const [x, y] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
            if (x >= 0 && x < m && y >= 0 && y < n && dist[x][y] === -1) { dist[x][y] = d; next.push([x, y]); }
          }
          fresh = next;
          if (!next.length) { snap("扩不动了", `上一圈的格子周围都已经有距离了，队列取空。`, view(), { at: ["pop", "next"] }); break; }
          snap(`第 ${d} 圈`, `上一圈的 ${q.length} 个格子依次出队，把周围还没走到的 ${next.length} 个格子的距离设成 ${d}，放进队列。`, view(), { at: ["pop", "next"] });
          q = next;
        }
        fresh = [];
        snap("完成", "每个格子第一次被走到时，就是离它最近的 0 先扩到的。", view(), { at: "done", kind: "ok", ans: dist.map((r) => r.slice()) });
      },
    },
  }],
};
