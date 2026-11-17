module.exports = {
  slug: "dfs", name: "深度优先搜索 DFS", kind: "algo", order: 6,
  lede: "DFS 沿着一条路一直往下走，走不动了再退回来换一条。用递归写最自然：处理当前节点，再对每个没去过的邻居递归。树、网格、图上的 DFS 是同一个模板，区别只在「邻居是谁」和「要不要记录走过」。",
  related: [104, 226, 101, 543, 112, 200, 79, 437, 124, 236],
  sections: [{
    key: "tree", t: "树上的 DFS",
    body: [
      "树没有环，不用记录走过哪些点。递归函数的含义要先想清楚：<code>hasPathSum(node, target)</code> 表示「从 node 往下走到某个叶子，路径和能不能正好是 target」。",
      "到了节点 node，剩下要凑的就是 <code>target - node.val</code>，交给左右子树去凑；到了叶子，看剩下的是不是 0。空节点直接返回 false。",
    ],
    points: [
      { t: "叶子的判断", body: "左右孩子都为空才是叶子。只有一个孩子的节点不能当终点，否则 <code>[1, 2]</code>、target = 1 会被误判成 true。" },
      { t: "短路", body: "<code>left or right</code>：左边找到了就不再走右边。" },
    ],
    codes: [{ t: "递归", key: "tree", code: `
class Solution:
    def hasPathSum(self, root: Optional[TreeNode], targetSum: int) -> bool:
        if not root:                            #@base
            return False                        #@base
        rest = targetSum - root.val             # 往下还要凑多少 #@visit
        if not root.left and not root.right:    # 叶子：看是不是正好凑够 #@leaf
            return rest == 0                    #@leaf
        return self.hasPathSum(root.left, rest) or self.hasPathSum(root.right, rest)    #@down
` }],
    sig: { fn: "hasPathSum", params: ["TreeNode", "int"], ret: "bool" },
    call: (a, H) => [H.toLc(a.t), a.target],
    cases: [[[], 0], [[1, 2], 1], [[1, 2, 3], 5], [[-2, null, -3], -5]],
    gen: (R) => {
      const t = R.tree(R.int(1, 8), () => R.int(-3, 9)), h = t.heap, sums = [];
      h.forEach((v, i) => { if (v != null && h[2 * i + 1] == null && h[2 * i + 2] == null) { let s = 0; for (let x = i; ; x = (x - 1) >> 1) { s += h[x]; if (!x) break; } sums.push(s); } });
      const target = R.chance(0.6) ? R.pick(sums) : R.int(-5, 25);
      return { args: { t: h, target }, note: `root = ${R.fmt(t.lc)}, targetSum = ${target}` };
    },
    demo: {
      legend: [["a", "当前节点"], ["e", "这条路上的节点"], ["c", "凑够了的叶子"], ["d", "试过、没凑够"]],
      presets: [{ label: "示例 1", args: { t: [5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, null, null, 1], target: 22 }, note: "root = [5,4,8,11,null,13,4,7,2,null,null,null,1], targetSum = 22", expect: true }, { label: "凑不出", args: { t: [1, 2, 3], target: 5 }, note: "root = [1,2,3], targetSum = 5", expect: false }],
      build(a, snap) {
        const N = {};
        a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
        const path = [], badges = {}, dead = new Set();
        let hit = -1;
        const view = (cur) => {
          const cls = {};
          for (const id in N) cls[id] = +id === hit ? "c" : +id === cur ? "a" : path.includes(+id) ? "e" : dead.has(+id) ? "d" : "";
          return [N[0] ? { t: "tree", label: "节点下面是「往下还要凑多少」", nodes: N, root: 0, cls, badges: { ...badges } } : { t: "note", html: "空树" }];
        };
        if (!N[0]) { snap("空树", "根是空的，没有路径，返回 false。", view(-1), { at: "base", kind: "ok", ans: false }); return; }
        const dfs = (id, target) => {
          if (id === null || !N[id]) return false;
          const nd = N[id], rest = target - nd.v;
          path.push(id); badges[id] = rest;
          const leaf = nd.l === null && nd.r === null;
          if (leaf) {
            const ok = rest === 0;
            if (ok) hit = id; else dead.add(id);
            snap(ok ? "凑够了" : "叶子", `到叶子 ${nd.v}，还要凑 ${target} - ${nd.v} = ${rest}。` + (ok ? "正好是 0，找到了一条路径。" : "不是 0，这条路不行，退回去。"), view(id), { at: ["visit", "leaf"] });
            path.pop();
            return ok;
          }
          snap("往下走", `到 ${nd.v}，往下还要凑 ${target} - ${nd.v} = ${rest}。先去左子树${nd.l === null ? "（空，直接返回 false）" : ""}，不行再去右子树。`, view(id), { at: ["visit", "down"] });
          const ok = dfs(nd.l, rest) || dfs(nd.r, rest);
          path.pop();
          if (!ok) dead.add(id);
          return ok;
        };
        const ans = dfs(0, a.target);
        snap("完成", ans ? "找到了一条和为 " + a.target + " 的路径，一层层返回 true。" : `所有的叶子都试过了，没有和为 ${a.target} 的路径，返回 false。`, view(-1), { at: "down", kind: "ok", ans });
      },
    },
  }, {
    key: "grid", t: "网格上的 DFS",
    body: [
      "网格上每个格子的邻居是上下左右。从一块陆地出发 DFS，能走到的陆地就是同一个岛。走过的格子要<b>做标记</b>（这里改成 2），否则会在两个相邻的格子之间来回走。",
      "递归函数返回「从这里出发能新淹掉多少块陆地」：越界、是水、或者来过，都返回 0；否则标记它，返回 1 加上四个方向的结果。外面扫一遍所有格子，取最大的。",
    ],
    points: [
      { t: "先判断再访问", body: "把越界和「不是没来过的陆地」放在函数开头一起判断，调用的地方就可以不管，直接朝四个方向递归。" },
      { t: "可以改原数组", body: "力扣允许修改 grid。不能改时另开一个 visited 数组。" },
    ],
    codes: [{ t: "递归淹没", key: "grid", code: `
class Solution:
    def maxAreaOfIsland(self, grid: List[List[int]]) -> int:
        m, n = len(grid), len(grid[0])
        def dfs(i: int, j: int) -> int:         # 从 (i, j) 出发能淹掉多少块陆地
            if not (0 <= i < m and 0 <= j < n) or grid[i][j] != 1:    # 出界、是水、或者来过 #@base
                return 0                        #@base
            grid[i][j] = 2                      # 标记来过 #@mark
            return 1 + dfs(i - 1, j) + dfs(i + 1, j) + dfs(i, j - 1) + dfs(i, j + 1)    #@spread
        best = 0
        for i in range(m):                      #@scan
            for j in range(n):                  #@scan
                best = max(best, dfs(i, j))     #@scan
        return best                             #@done
` }],
    sig: { fn: "maxAreaOfIsland", params: ["int[][]"], ret: "int" },
    call: (a) => [a.grid],
    cases: [[[[0, 0, 0, 0, 0]]], [[[1]]], [[[1, 1, 0], [0, 1, 0], [1, 0, 1]]]],
    gen: (R) => { const m = R.int(3, 5), n = R.int(3, 6), grid = Array.from({ length: m }, () => Array.from({ length: n }, () => (R.chance(0.45) ? 1 : 0))); return { args: { grid }, note: `grid = ${R.fmt(grid)}` }; },
    demo: {
      legend: [["a", "刚淹掉的格子"], ["e", "这个岛已经淹掉的"], ["k", "别的岛（已经数过）"], ["w", "还没走到的陆地"]],
      presets: [{ label: "示例", args: { grid: [[1, 1, 0, 0, 1], [1, 0, 0, 1, 1], [0, 0, 1, 1, 0], [0, 0, 0, 0, 0], [1, 1, 0, 1, 0]] }, note: "grid = [[1,1,0,0,1],[1,0,0,1,1],[0,0,1,1,0],[0,0,0,0,0],[1,1,0,1,0]]", expect: 5 }],
      build(a, snap) {
        const g = a.grid.map((r) => r.slice()), m = g.length, n = g[0].length, island = new Set();
        let cur = null, best = 0;
        const view = () => [{ t: "grid", rows: g.map((r, i) => r.map((v, j) => ({ v: "", cls: cur && cur[0] === i && cur[1] === j ? "a" : island.has(i * n + j) ? "e" : v === 2 ? "k" : v === 1 ? "w" : "" }))) }];
        snap("开始", "从左上角开始一格格扫。碰到没来过的陆地，就从它开始 DFS。", view(), { at: "scan", facts: [["最大面积", 0]] });
        for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
          if (g[i][j] !== 1) continue;
          island.clear();
          let area = 0;
          const dfs = (x, y) => {
            if (x < 0 || x >= m || y < 0 || y >= n || g[x][y] !== 1) return;
            g[x][y] = 2; island.add(x * n + y); area++; cur = [x, y];
            snap("淹掉", `(${x}, ${y}) 是没来过的陆地，标记成来过，面积 +1 = ${area}。接着往上、下、左、右递归。`, view(), { at: ["mark", "spread"], facts: [["这个岛", area], ["最大面积", best]] });
            dfs(x - 1, y); dfs(x + 1, y); dfs(x, y - 1); dfs(x, y + 1);
          };
          dfs(i, j);
          best = Math.max(best, area); cur = null;
          snap("一个岛", `从 (${i}, ${j}) 出发的 DFS 返回了，这个岛的面积是 ${area}。最大面积是 ${best}。`, view(), { at: "scan", facts: [["这个岛", area], ["最大面积", best]] });
          island.clear();
        }
        snap("完成", `扫完了，最大的岛面积是 ${best}。`, view(), { at: "done", kind: "ok", ans: best, facts: [["最大面积", best]] });
      },
    },
  }, {
    key: "graph", t: "图上的 DFS",
    body: [
      "图可能有环，所以一定要记 <code>seen</code>：进入一个点时先标记，之后再遇到它就不进去了。每个点只进一次，O(n + m)。",
      "这道题：房间 0 是开着的，每个房间里有一些钥匙，能不能进所有房间？房间是点，「房间 u 里有 v 的钥匙」是一条边 u → v。从 0 开始 DFS，看最后是不是每个点都走到了。",
    ],
    points: [
      { t: "邻接表现成的", body: "<code>rooms[u]</code> 本身就是 u 的邻居列表，不用再建图。" },
      { t: "递归太深时", body: "点很多的链状图可能递归太深。可以用一个栈改成迭代，或者用 BFS。" },
    ],
    codes: [{ t: "递归 + seen", key: "graph", code: `
class Solution:
    def canVisitAllRooms(self, rooms: List[List[int]]) -> bool:
        seen = [False] * len(rooms)
        def dfs(u: int) -> None:
            seen[u] = True                      # 进了房间 u #@visit
            for v in rooms[u]:                  # 用房间里的钥匙 #@next
                if not seen[v]:                 # 没进过的才进去 #@next
                    dfs(v)                      #@next
        dfs(0)                                  #@start
        return all(seen)                        #@done
` }],
    sig: { fn: "canVisitAllRooms", params: ["List<List<int>>"], ret: "bool" },
    call: (a) => [a.rooms],
    cases: [[[[1], [2], [3], []]], [[[1, 3], [3, 0, 1], [2], [0]]], [[[]]], [[[1], []]]],
    gen: (R) => { const n = R.int(3, 6), rooms = Array.from({ length: n }, () => R.distinct(R.int(0, 2), 0, n - 1)); return { args: { rooms }, note: `rooms = ${R.fmt(rooms)}` }; },
    demo: {
      legend: [["a", "正在的房间"], ["e", "在递归栈上"], ["c", "进过了"]],
      presets: [{ label: "示例 1", args: { rooms: [[1], [2], [3], []] }, note: "rooms = [[1],[2],[3],[]]", expect: true }, { label: "示例 2", args: { rooms: [[1, 3], [3, 0, 1], [2], [0]] }, note: "rooms = [[1,3],[3,0,1],[2],[0]]", expect: false }],
      build(a, snap) {
        const R = a.rooms, n = R.length, seen = new Array(n).fill(false), stack = [];
        let cur = -1;
        const view = () => [{ t: "net", label: "房间 u → 它里面钥匙对应的房间", directed: true, nodes: R.map((_, i) => ({ v: i, cls: i === cur ? "a" : stack.includes(i) ? "e" : seen[i] ? "c" : "" })), edges: R.flatMap((ks, u) => ks.filter((v) => v !== u).map((v) => [u, v, u === cur && !seen[v] ? "on" : ""])) }, { t: "chips", label: "进过的房间", items: seen.map((s, i) => (s ? i : null)).filter((x) => x !== null), empty: "还没有" }];
        snap("开始", "房间 0 是开着的，从它开始 DFS。", view(), { at: "start" });
        const dfs = (u) => {
          seen[u] = true; stack.push(u); cur = u;
          const keys = R[u], go = keys.filter((v) => !seen[v]);
          snap("进房间", `进了房间 ${u}，标记 seen。里面的钥匙是 [${keys.join(", ")}]` + (go.length ? `，先去没进过的 ${go[0]}。` : "，对应的房间都进过了（或者没有钥匙），退回去。"), view(), { at: ["visit", "next"] });
          for (const v of keys) if (!seen[v]) { dfs(v); cur = u; }
          stack.pop();
        };
        dfs(0); cur = -1;
        const all = seen.every(Boolean);
        snap("完成", all ? "每个房间都进过了，返回 true。" : `房间 ${seen.map((s, i) => (s ? null : i)).filter((x) => x !== null).join("、")} 一直没进去，返回 false。`, view(), { at: "done", kind: "ok", ans: all });
      },
    },
  }],
};
