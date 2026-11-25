module.exports = {
  slug: "union-find", name: "并查集", kind: "ds", order: 9,
  lede: "并查集维护「哪些点已经连在一起」：每个集合是一棵树，用根节点代表整个集合。合并两个集合就是把一个根挂到另一个根下面；判断两个点是否连通就看它们的根是不是同一个。加上路径压缩和按大小合并后，每次操作几乎是 O(1)。",
  related: [200, 128],
  sections: [{
    key: "basic", t: "查找和合并",
    body: [
      "只用一个数组 <code>parent</code>：<code>parent[x]</code> 是 x 的父节点，根节点的父节点是它自己。一开始每个点自成一个集合。",
      "<b>查找</b> <code>find(x)</code>：沿着 parent 一直往上走到根。<b>合并</b> <code>unite(a, b)</code>：先找到两边的根，根相同说明已经在一个集合里；不同就把一个根的 parent 指向另一个根。",
      "两个优化让树一直很矮：<b>路径压缩</b>——查找时顺手让节点直接指向更高的祖先（这里用「隔一个跳一个」的写法，不用递归）；<b>按大小合并</b>——小树挂到大树下面。",
    ],
    points: [
      { t: "unite 返回布尔值", body: "返回「这次有没有真的合并」很有用：返回 false 就说明两点本来就连通，比如加这条边会形成环。" },
      { t: "集合个数", body: "初始有 n 个集合，每次成功合并少一个。连通分量的个数不用再数一遍。" },
    ],
    codes: [{ t: "路径压缩 + 按大小合并", key: "basic", code: `
class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))        # 一开始每个点自己是根 #@init
        self.size = [1] * n                 #@init
        self.parts = n                      # 集合的个数 #@init

    def find(self, x: int) -> int:
        while self.parent[x] != x:          # 往上走到根 #@find
            self.parent[x] = self.parent[self.parent[x]]    # 路径压缩：指向爷爷 #@find
            x = self.parent[x]              #@find
        return x                            #@find

    def unite(self, a: int, b: int) -> bool:
        ra, rb = self.find(a), self.find(b) #@roots
        if ra == rb:                        # 已经在一个集合里 #@same
            return False                    #@same
        if self.size[ra] < self.size[rb]:   # 小树挂到大树下面 #@merge
            ra, rb = rb, ra                 #@merge
        self.parent[rb] = ra                #@merge
        self.size[ra] += self.size[rb]      #@merge
        self.parts -= 1                     #@merge
        return True                         #@merge

    def connected(self, a: int, b: int) -> bool:
        return self.find(a) == self.find(b) #@ask

    def count(self) -> int:
        return self.parts                   #@count
` }],
    sig: { cls: "UnionFind", ctor: ["int"], methods: { find: [["int"], "int"], unite: [["int", "int"], "bool"], connected: [["int", "int"], "bool"], count: [[], "int"] } },
    call: (a) => [["UnionFind", ...a.ops.map((o) => o[0])], [[a.n], ...a.ops.map((o) => o.slice(1))]],
    cases: [[["UnionFind", "count", "unite", "unite", "connected", "unite", "count"], [[3], [], [0, 1], [1, 0], [0, 2], [1, 2], []]], [["UnionFind", "connected", "count"], [[1], [0, 0], []]]],
    gen: (R) => {
      const n = R.int(4, 7), ops = [];
      for (let k = R.int(6, 9); k > 0; k--) {
        const o = R.pick(["unite", "unite", "unite", "connected", "count"]);
        ops.push(o === "count" ? [o] : [o, R.int(0, n - 1), R.int(0, n - 1)]);
      }
      return { args: { n, ops }, note: `n = ${n}：` + ops.map((o) => `${o[0]}(${o.slice(1).join(", ")})`).join(" ") };
    },
    demo: {
      legend: [["a", "正在查找的点"], ["b", "根"], ["c", "这次合并的两棵树"]],
      presets: [{ label: "示例", args: { n: 6, ops: [["unite", 0, 1], ["unite", 2, 3], ["unite", 1, 3], ["unite", 4, 5], ["connected", 0, 2], ["connected", 0, 4], ["unite", 2, 0], ["count"]] }, note: "n = 6：unite(0, 1) unite(2, 3) unite(1, 3) unite(4, 5) connected(0, 2) connected(0, 4) unite(2, 0) count()", expect: [null, true, true, true, true, true, false, false, 2] }],
      build(a, snap) {
        const n = a.n, parent = Array.from({ length: n }, (_, i) => i), size = new Array(n).fill(1), out = [null];
        let parts = n, hot = [], roots = [], newEdges = new Set();
        // 每个点画在第 i 列、第「到根的距离」行，根都在最上面一行
        const depth = (i) => { let d = 0; for (let y = i; parent[y] !== y; y = parent[y]) d++; return d; };
        const view = (opts = {}) => {
          const prevParent = opts.prevParent || {};
          return [
            {
              t: "net",
              label: "森林（箭头指向父节点）",
              directed: true,
              pos: parent.map((_, i) => [i, depth(i)]),
              nodes: parent.map((p, i) => ({ v: i, cls: hot.includes(i) ? "a" : roots.includes(i) ? "c" : p === i ? "b" : "" })),
              edges: parent.map((p, i) => [i, p, newEdges.has(i) ? "on draw" : hot.includes(i) ? "on" : ""]).filter(([i, p]) => i !== p),
              badges: parent.map((p, i) => (p === i ? `大小 ${size[i]}` : "")),
            },
            {
              t: "array",
              label: "parent",
              items: parent.map((p, i) => ({
                v: p,
                ...(prevParent[i] !== undefined ? { prev: prevParent[i] } : {}),
                cls: hot.includes(i) ? "a" : roots.includes(i) ? "c" : "",
              })),
              ptrs: opts.ptrs || {},
            },
            { t: "chips", label: "返回值", items: out.map((x) => (x === null ? "null" : String(x))) },
          ];
        };
        // 和代码一样：查找时让节点指向爷爷（隔一个跳一个）
        const find = (x, prevParent) => {
          const path = [x];
          while (parent[x] !== x) {
            const gp = parent[parent[x]];
            if (gp !== parent[x] && prevParent[x] === undefined) prevParent[x] = parent[x];
            parent[x] = gp;
            x = parent[x];
            path.push(x);
          }
          return { r: x, path };
        };
        snap("开始", `${n} 个点各自是一个集合，parent[i] = i。`, view(), {
          at: "init",
          facts: [["当前操作", "初始化"], ["集合个数", parts], ["返回值数", 1]],
        });
        let prevOp = "初始化";
        for (const [op, x, y] of a.ops) {
          hot = []; roots = []; newEdges = new Set();
          if (op === "count") {
            out.push(parts);
            snap("count()", `现在有 ${parts} 个集合。`, view(), {
              at: "count",
              facts: [["当前操作", "count()", prevOp], ["集合个数", parts], ["返回值", parts]],
            });
            prevOp = "count()";
            continue;
          }
          const prevParent = {};
          const A = find(x, prevParent), B = find(y, prevParent);
          hot = [...new Set([...A.path, ...B.path])];
          newEdges = new Set(Object.keys(prevParent).map(Number));
          const opName = `${op}(${x}, ${y})`;
          if (op === "connected") {
            out.push(A.r === B.r);
            snap(opName, `${x} 的根是 ${A.r}，${y} 的根是 ${B.r}，${A.r === B.r ? "相同：连通，返回 true" : "不同：不连通，返回 false"}。`, view({ prevParent, ptrs: { a: x, b: y } }), {
              at: ["ask", "find"],
              facts: [["当前操作", opName, prevOp], ["两边的根", `${A.r} vs ${B.r}`], ["集合个数", parts]],
            });
            prevOp = opName;
            continue;
          }
          snap(opName, `先找根：${x} 一路往上是 ${A.path.join(" → ")}，${y} 一路往上是 ${B.path.join(" → ")}。`, view({ prevParent, ptrs: { a: x, b: y } }), {
            at: ["roots", "find"],
            facts: [["当前操作", opName, prevOp], ["两边的根", `${A.r} 和 ${B.r}`], ["集合个数", parts]],
          });
          prevOp = opName;
          if (A.r === B.r) {
            out.push(false); hot = []; newEdges = new Set();
            snap("已经连通", `两个根都是 ${A.r}，已经在一个集合里，返回 false。`, view({ ptrs: { ra: A.r } }), {
              at: "same",
              facts: [["当前操作", opName], ["结果", "已连通 (false)"], ["集合个数", parts]],
            });
            continue;
          }
          let ra = A.r, rb = B.r;
          if (size[ra] < size[rb]) [ra, rb] = [rb, ra];
          const mergePrev = { [rb]: rb };
          parent[rb] = ra; size[ra] += size[rb]; parts--; out.push(true);
          hot = []; roots = [ra, rb]; newEdges = new Set([rb]);
          snap("合并", `根 ${A.r} 的树有 ${A.r === ra ? size[ra] - size[rb] : size[rb]} 个点，根 ${B.r} 的有 ${B.r === ra ? size[ra] - size[rb] : size[rb]} 个。把小的根 ${rb} 挂到 ${ra} 下面，现在有 ${parts} 个集合。`, view({ prevParent: mergePrev, ptrs: { ra, rb } }), {
            at: "merge",
            kind: "ok",
            facts: [["当前操作", opName], ["合并方向", `${rb} → ${ra}`], ["集合个数", parts, parts + 1]],
          });
        }
        hot = []; roots = []; newEdges = new Set();
        snap("完成", "每棵树是一个集合，根代表整个集合。", view(), {
          at: [],
          kind: "ok",
          ans: out,
          facts: [["当前操作", "完成", prevOp], ["最终集合数", parts], ["返回值数", out.length]],
        });
      },
    },
  }, {
    key: "redundant", t: "应用：找多余的边",
    body: [
      "一棵树加了一条边，变成有一个环的图，找出这条多余的边（有多条时返回最后出现的）。按顺序把边一条条加进并查集：如果某条边的两个端点<b>已经连通</b>，再连上它就成环了，它就是答案。",
      "这比每加一条边就 DFS 检查一次连通性快得多：总共 O(n·α(n))，α 是增长极慢的反阿克曼函数，实际上就当成常数。",
    ],
    points: [
      { t: "点的编号从 1 开始", body: "parent 开 n + 1 格，下标 0 不用。" },
      { t: "为什么是最后出现的", body: "按顺序加边，第一条让两个已经连通的点再连上的边就是答案。题目保证只多一条边，所以它也是环上最后出现的。" },
    ],
    codes: [{ t: "并查集", key: "redundant", code: `
class Solution:
    def findRedundantConnection(self, edges: List[List[int]]) -> List[int]:
        parent = list(range(len(edges) + 1))    # 点的编号是 1 到 n #@init

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        for u, v in edges:                      #@edge
            ru, rv = find(u), find(v)           #@edge
            if ru == rv:                        # 已经连通，再连就成环了 #@found
                return [u, v]                   #@found
            parent[ru] = rv                     #@union
        return []
` }],
    sig: { fn: "findRedundantConnection", params: ["int[][]"], ret: "int[]" },
    call: (a) => [a.edges],
    cases: [[[[1, 2], [1, 3], [2, 3]]], [[[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]], [[[3, 4], [1, 2], [2, 4], [3, 5], [2, 5]]]],
    gen: (R) => {
      const n = R.int(4, 7), edges = [], has = new Set();
      for (let v = 2; v <= n; v++) { const u = R.int(1, v - 1); edges.push(R.chance(0.5) ? [u, v] : [v, u]); has.add(`${Math.min(u, v)},${Math.max(u, v)}`); }
      for (;;) { const u = R.int(1, n), v = R.int(1, n); if (u !== v && !has.has(`${Math.min(u, v)},${Math.max(u, v)}`)) { edges.push([Math.min(u, v), Math.max(u, v)]); break; } }
      const shuffled = R.shuffle(edges).map(([u, v]) => [Math.min(u, v), Math.max(u, v)]);
      return { args: { edges: shuffled }, note: `edges = ${R.fmt(shuffled)}` };
    },
    demo: {
      legend: [["a", "这条边的两个端点"], ["c", "已经连通的点"], ["w", "多余的边（成环）"]],
      presets: [{ label: "示例 2", args: { edges: [[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]] }, note: "edges = [[1,2],[2,3],[3,4],[1,4],[1,5]]", expect: [1, 4] }],
      build(a, snap) {
        const E = a.edges, n = E.length, parent = Array.from({ length: n + 1 }, (_, i) => i);
        const find = (x, prevParent) => {
          while (parent[x] !== x) {
            const gp = parent[parent[x]];
            if (gp !== parent[x] && prevParent[x] === undefined) prevParent[x] = parent[x];
            parent[x] = gp;
            x = parent[x];
          }
          return x;
        };
        let added = 0, hot = [], bad = -1, newEdge = -1, comps = n;
        const view = (opts = {}) => {
          const prevParent = opts.prevParent || {};
          const comp = {};
          for (let i = 1; i <= n; i++) { let x = i; while (parent[x] !== x) x = parent[x]; comp[i] = x; }
          return [
            {
              t: "net",
              label: "图（实线是已经加进来的边，虚线×是多余的边）",
              nodes: Array.from({ length: n }, (_, i) => ({ v: i + 1, cls: hot.includes(i + 1) ? (bad >= 0 ? "w" : "a") : "" })),
              edges: E.map(([u, v], k) => [u - 1, v - 1, k === bad ? "cut" : k === newEdge ? "on draw" : k < added ? "on" : "dim"]),
              badges: Array.from({ length: n }, (_, i) => `根 ${comp[i + 1]}`),
            },
            {
              t: "array",
              label: "parent（下标从 1 开始）",
              items: parent.slice(1).map((p, i) => ({
                v: p,
                ...(prevParent[i + 1] !== undefined ? { prev: prevParent[i + 1] } : {}),
                cls: hot.includes(i + 1) ? (bad >= 0 ? "w" : "a") : "",
              })),
              labels: parent.slice(1).map((_, i) => i + 1),
              ptrs: opts.ptrs || {},
            },
          ];
        };
        snap("开始", `${n} 个点各自是一个集合。按顺序把边加进去。`, view(), {
          at: "init",
          facts: [["当前边", "—"], ["已加边数", `0 / ${n}`], ["集合个数", n]],
        });
        let prevEdge = "—";
        for (let k = 0; k < n; k++) {
          const [u, v] = E[k], prevParent = {}, ru = find(u, prevParent), rv = find(v, prevParent);
          hot = [u, v];
          const edgeStr = `[${u}, ${v}]`;
          if (ru === rv) {
            bad = k; newEdge = -1;
            snap("成环了", `边 [${u}, ${v}]：${u} 和 ${v} 的根都是 ${ru}，已经连通了。再连这条边就成环，它就是多余的。`, view({ prevParent, ptrs: { u: u - 1, v: v - 1 } }), {
              at: ["edge", "found"],
              kind: "ok",
              ans: [u, v],
              facts: [["当前边", edgeStr, prevEdge], ["两边的根", `都是 ${ru}`], ["多余边", edgeStr]],
            });
            return;
          }
          if (prevParent[ru] === undefined) prevParent[ru] = ru;
          parent[ru] = rv; added = k + 1; newEdge = k; comps--;
          snap("合并", `边 [${u}, ${v}]：${u} 的根是 ${ru}，${v} 的根是 ${rv}，不同。把 ${ru} 挂到 ${rv} 下面。`, view({ prevParent, ptrs: { u: u - 1, v: v - 1 } }), {
            at: ["edge", "union"],
            facts: [["当前边", edgeStr, prevEdge], ["合并根", `${ru} → ${rv}`], ["集合个数", comps, comps + 1]],
          });
          prevEdge = edgeStr;
        }
        snap("完成", "没有多余的边。", view(), {
          at: [],
          kind: "ok",
          ans: [],
          facts: [["当前边", "—", prevEdge], ["结果", "[]"]],
        });
      },
    },
  }],
};
