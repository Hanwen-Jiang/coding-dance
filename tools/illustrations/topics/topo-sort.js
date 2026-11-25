module.exports = {
  slug: "topo-sort", name: "拓扑排序", kind: "algo", order: 12,
  lede: "有向图里，边 u → v 表示「u 要排在 v 前面」（先修课、任务依赖）。拓扑排序就是给所有点排一个顺序，让每条边都从前指向后。只有没有环的图（DAG）才排得出来，所以它也是判断有向图有没有环的标准方法。",
  related: [207],
  sections: [{
    key: "kahn", t: "BFS：不断取出入度为 0 的点（Kahn 算法）",
    body: [
      "一个点的<b>入度</b>是指向它的边数，也就是「还差几门先修课」。入度为 0 的课现在就能学。把它们放进队列，每学完一门 u，它的后续课 v 的入度减一；减到 0 的 v 也能学了，放进队列。",
      "队列空了以后，如果学过的课数等于总数，学的顺序就是一个拓扑序；如果少了，剩下的课互相等着对方，说明图里有环，返回空。",
    ],
    points: [
      { t: "边的方向", body: "<code>[a, b]</code> 表示学 a 之前要先学 b，所以边是 <code>b → a</code>，a 的入度加一。" },
      { t: "答案不唯一", body: "同一时刻有好几门课入度为 0 时，先学哪门都行。这里按编号从小到大放进队列。" },
    ],
    codes: [{ t: "入度 + 队列", key: "kahn", code: `
class Solution:
    def findOrder(self, numCourses: int, prerequisites: List[List[int]]) -> List[int]:
        graph = [[] for _ in range(numCourses)]     # 先修课 -> 后续课 #@init
        indeg = [0] * numCourses                    # 还差几门先修课 #@init
        for a, b in prerequisites:                  # 学 a 之前要先学 b：边 b -> a #@init
            graph[b].append(a)                      #@init
            indeg[a] += 1                           #@init
        q = deque(i for i in range(numCourses) if indeg[i] == 0)   # 现在就能学的课 #@start
        order = []
        while q:
            u = q.popleft()                         #@pop
            order.append(u)                         #@pop
            for v in graph[u]:                      # 学完 u，后续课少了一门先修 #@next
                indeg[v] -= 1                       #@next
                if indeg[v] == 0:                   # 先修课都学完了 #@ready
                    q.append(v)                     #@ready
        return order if len(order) == numCourses else []    # 少了说明有环 #@done
` }],
    sig: { fn: "findOrder", params: ["int", "int[][]"], ret: "int[]" },
    call: (a) => [a.n, a.pre],
    cases: [[2, [[1, 0]]], [4, [[1, 0], [2, 0], [3, 1], [3, 2]]], [1, []], [2, [[1, 0], [0, 1]]], [3, [[0, 1], [0, 2], [1, 2]]]],
    gen: (R) => {
      const n = R.int(3, 6), perm = R.shuffle(Array.from({ length: n }, (_, i) => i)), pre = [], has = new Set();
      for (let k = R.int(1, n + 1), guard = 0; pre.length < k && guard < 60; guard++) {
        let x = R.int(0, n - 1), y = R.int(0, n - 1);
        if (x === y) continue;
        if (x > y) [x, y] = [y, x];
        const a = perm[y], b = perm[x];             // 按 perm 的顺序连边，一定没有环
        if (!has.has(`${a},${b}`)) { has.add(`${a},${b}`); pre.push([a, b]); }
      }
      if (R.chance(0.2) && pre.length) { const [a, b] = R.pick(pre); pre.push([b, a]); }     // 偶尔加一条反向边，制造环
      return { args: { n, pre }, note: `numCourses = ${n}, prerequisites = ${R.fmt(pre)}` };
    },
    demo: {
      legend: [["a", "刚学完的课"], ["e", "在队列里（可以学了）"], ["c", "学过了"], ["w", "在环上（学不到）"]],
      presets: [
        { label: "示例 2", args: { n: 4, pre: [[1, 0], [2, 0], [3, 1], [3, 2]] }, note: "numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]", expect: [0, 1, 2, 3] },
        { label: "有环", args: { n: 4, pre: [[1, 0], [2, 1], [3, 2], [1, 3]] }, note: "numCourses = 4, prerequisites = [[1,0],[2,1],[3,2],[1,3]]", expect: [] },
      ],
      build(a, snap) {
        const n = a.n, g = Array.from({ length: n }, () => []), indeg = new Array(n).fill(0), order = [];
        for (const [x, y] of a.pre) { g[y].push(x); indeg[x]++; }
        const q = [];
        let cur = -1;
        const view = (opts = {}) => {
          const prevIndeg = opts.prevIndeg || {}, fin = !!opts.fin;
          const nodeCls = (i) => (i === cur ? "a" : q.includes(i) ? "e" : order.includes(i) ? "c" : fin ? "w" : "");
          return [
            {
              t: "net",
              label: "先修课 → 后续课（虚线×表示依赖解除）",
              directed: true,
              nodes: Array.from({ length: n }, (_, i) => ({ v: i, cls: nodeCls(i) })),
              edges: a.pre.map(([x, y]) => [y, x, y === cur ? "cut" : order.includes(y) ? "dim" : fin && !order.includes(y) ? "warm" : ""]),
              badges: indeg.map((d, i) => (order.includes(i) ? "已学" : `入度 ${d}`)),
            },
            {
              t: "array",
              label: "indeg（每门课还差几门先修课）",
              items: indeg.map((d, i) => ({
                v: d,
                ...(prevIndeg[i] !== undefined ? { prev: prevIndeg[i] } : {}),
                cls: nodeCls(i),
              })),
              ptrs: { u: cur >= 0 ? cur : null },
            },
            { t: "chips", label: "队列（左边先出）", items: q.map((x) => ({ v: x, cls: "e" })), empty: "空" },
            { t: "chips", label: "学的顺序", items: order.map((x, idx) => ({ v: x, cls: idx === order.length - 1 && cur >= 0 ? "a" : "c" })), empty: "还没有" },
          ];
        };
        snap("建图", `每条 [a, b] 连一条 b → a，并给 a 的入度加一。`, view(), {
          at: "init",
          facts: [["当前课程", "—"], ["已学课程", `0 / ${n}`], ["队列长度", 0]],
        });
        for (let i = 0; i < n; i++) if (indeg[i] === 0) q.push(i);
        snap("入度为 0 的课入队", q.length ? `入度为 0 的课 ${q.join("、")} 现在就能学，放进队列。` : "没有入度为 0 的课：每门课都在等别的课，一开始就卡住了。", view(), {
          at: "start",
          facts: [["当前课程", "—"], ["已学课程", `0 / ${n}`], ["队列长度", q.length, 0]],
        });
        let prevCur = "—";
        while (q.length) {
          const prevOrderLen = order.length, prevQ = q.length;
          cur = q.shift(); order.push(cur);
          const ready = [], prevIndeg = {};
          for (const v of g[cur]) {
            prevIndeg[v] = indeg[v];
            indeg[v]--;
            if (indeg[v] === 0) { q.push(v); ready.push(v); }
          }
          snap("学一门", `学完 ${cur}。` + (g[cur].length ? `解除它的出边依赖，后续课 ${g[cur].join("、")} 入度各减一` + (ready.length ? `，${ready.join("、")} 减到 0 了，放进队列。` : "，还没有减到 0 的。") : "它没有后续课。"), view({ prevIndeg }), {
            at: ready.length ? ["pop", "next", "ready"] : ["pop", "next"],
            facts: [["当前课程", cur, prevCur], ["已学课程", `${order.length} / ${n}`, `${prevOrderLen} / ${n}`], ["队列长度", q.length, prevQ]],
          });
          prevCur = cur;
        }
        cur = -1;
        const ok = order.length === n;
        snap(ok ? "完成" : "有环", ok ? `${n} 门课都学完了，顺序是 [${order.join(", ")}]。` : `只学了 ${order.length} 门，剩下的课入度一直减不到 0，它们构成了环，返回空数组。`, view({ fin: !ok }), {
          at: "done",
          kind: ok ? "ok" : "warn",
          ans: ok ? order : [],
          facts: [["当前课程", "—", prevCur], ["已学课程", `${order.length} / ${n}`], ["结果", ok ? `[${order.join(", ")}]` : "[] (有环)"]],
        });
      },
    },
  }, {
    key: "color", t: "DFS：三色标记找环",
    body: [
      "用 DFS 判断有没有环：每个点有三种状态——<b>0 没走过</b>、<b>1 正在走</b>（还在递归栈上）、<b>2 走完了而且安全</b>。DFS 时碰到状态 1 的点，说明沿着边绕回了还没走完的祖先，有环。",
      "这道题问哪些点是「安全」的：从它出发不管怎么走都会停下来，也就是走不到任何环。一个点安全，当且仅当它指向的点都安全。DFS 时，邻居里只要有一个不安全，它就不安全，状态留在 1；全部安全才标成 2。",
    ],
    points: [
      { t: "状态 1 留着", body: "不安全的点不用改回 0：以后再碰到它，状态 1 直接就能说明「从这里能走到环」。" },
      { t: "后序就是逆拓扑序", body: "DFS 结束（标成 2）的顺序反过来，就是一个拓扑序。" },
    ],
    codes: [{ t: "三色 DFS", key: "color", code: `
class Solution:
    def eventualSafeNodes(self, graph: List[List[int]]) -> List[int]:
        color = [0] * len(graph)                # 0 没走过，1 正在走（在递归栈上），2 安全 #@init
        def safe(u: int) -> bool:
            if color[u]:                        # 走过了：1 说明绕回来了，有环 #@seen
                return color[u] == 2            #@seen
            color[u] = 1                        #@enter
            for v in graph[u]:                  #@next
                if not safe(v):                 # 能走到环上，u 也不安全 #@next
                    return False                #@next
            color[u] = 2                        # 走出去的路都安全 #@safe
            return True                         #@safe
        return [u for u in range(len(graph)) if safe(u)]   #@done
` }],
    sig: { fn: "eventualSafeNodes", params: ["List<List<int>>"], ret: "List<int>" },
    call: (a) => [a.graph],
    cases: [[[[1, 2], [2, 3], [5], [0], [5], [], []]], [[[1, 2, 3, 4], [1, 2], [3, 4], [0, 4], []]], [[[]]], [[[0]]]],
    gen: (R) => { const n = R.int(3, 6), graph = Array.from({ length: n }, () => R.sorted(R.distinct(R.int(0, 2), 0, n - 1))); return { args: { graph }, note: `graph = ${R.fmt(graph)}` }; },
    demo: {
      legend: [["e", "1：正在走（在递归栈上）"], ["c", "2：安全"], ["w", "能走到环：不安全"], ["a", "当前的点"]],
      presets: [{ label: "示例 1", args: { graph: [[1, 2], [2, 3], [5], [0], [5], [], []] }, note: "graph = [[1,2],[2,3],[5],[0],[5],[],[]]", expect: [2, 4, 5, 6] }],
      build(a, snap) {
        const G = a.graph, n = G.length, color = new Array(n).fill(0), stack = [], res = [];
        let cur = -1, outer = false, activeEdge = null, badEdge = null, safeCount = 0;
        const isStackEdge = (u, v) => {
          const i = stack.indexOf(u);
          return i >= 0 && stack[i + 1] === v;
        };
        const view = (opts = {}) => {
          const prevColor = opts.prevColor || {};
          const nodeCls = (i) => (i === cur ? "a" : color[i] === 2 ? "c" : color[i] === 1 ? (stack.includes(i) || !outer ? "e" : "w") : "");
          return [
            {
              t: "net",
              label: "有向图（节点下面是三色状态）",
              directed: true,
              nodes: G.map((_, i) => ({ v: i, cls: nodeCls(i) })),
              edges: G.flatMap((vs, u) => vs.map((v) => {
                const cls = badEdge && badEdge[0] === u && badEdge[1] === v
                  ? "warm"
                  : activeEdge && activeEdge[0] === u && activeEdge[1] === v
                    ? "on draw"
                    : isStackEdge(u, v)
                      ? "on"
                      : color[u] === 2
                        ? "dim"
                        : "";
                return [u, v, cls];
              })),
              badges: color.map((c, i) => (c === 2 ? "2:安全" : c === 1 ? (stack.includes(i) || !outer ? "1:在栈" : "1:危险") : "0:未走")),
            },
            {
              t: "array",
              label: "color（0 未走过，1 正在走/危险，2 安全）",
              items: color.map((c, i) => ({
                v: c,
                ...(prevColor[i] !== undefined ? { prev: prevColor[i] } : {}),
                cls: nodeCls(i),
              })),
              ptrs: { u: cur >= 0 ? cur : null },
            },
            { t: "chips", label: "安全的点", items: res.map((x) => ({ v: x, cls: "c" })), empty: "还没有" },
          ];
        };
        snap("开始", "所有点都是 0（没走过）。从 0 号点开始，挨个问「安全吗」。", view(), {
          at: "init",
          facts: [["当前点", "—"], ["已确认安全", 0], ["递归栈深", 0]],
        });
        let prevCur = "—";
        const safe = (u, parent) => {
          if (color[u]) {
            cur = u;
            activeEdge = parent !== null ? [parent, u] : null;
            badEdge = color[u] === 1 && parent !== null ? [parent, u] : null;
            snap("走过了", color[u] === 2 ? `${u} 已经确认安全。` : stack.includes(u) ? `${u} 的状态是 1，还在递归栈上：绕回来了，有环！` : `${u} 之前已经确认能走到环，不安全。`, view(), {
              at: "seen",
              ...(color[u] === 1 ? { kind: "warn" } : {}),
              facts: [["当前点", u, prevCur], ["状态", color[u] === 2 ? "2 (安全)" : "1 (有环/危险)"], ["递归栈深", stack.length]],
            });
            prevCur = u;
            activeEdge = null; badEdge = null;
            return color[u] === 2;
          }
          const prevDepth = stack.length;
          color[u] = 1; stack.push(u); cur = u;
          activeEdge = parent !== null ? [parent, u] : null;
          badEdge = null;
          snap("进入", `${u} 标成 1（正在走），看它指向的 [${G[u].join(", ")}]。`, view({ prevColor: { [u]: 0 } }), {
            at: ["enter", "next"],
            facts: [["当前点", u, prevCur], ["已确认安全", safeCount], ["递归栈深", stack.length, prevDepth]],
          });
          prevCur = u;
          activeEdge = null;
          for (const v of G[u]) {
            if (!safe(v, u)) {
              cur = u;
              badEdge = [u, v];
              snap("不安全", `${u} 指向的 ${v} 不安全，${u} 也不安全，状态留在 1。`, view(), {
                at: "next",
                kind: "warn",
                facts: [["当前点", u, prevCur], ["已确认安全", safeCount], ["递归栈深", stack.length]],
              });
              prevCur = u;
              badEdge = null;
              stack.pop();
              return false;
            }
            cur = u;
          }
          const prevSafe = safeCount, depthBeforePop = stack.length;
          color[u] = 2; stack.pop(); safeCount++;
          snap("安全", `${u} 指向的点都安全（或者它没有出边），标成 2。`, view({ prevColor: { [u]: 1 } }), {
            at: "safe",
            kind: "ok",
            facts: [["当前点", u, prevCur], ["已确认安全", safeCount, prevSafe], ["递归栈深", stack.length, depthBeforePop]],
          });
          prevCur = u;
          return true;
        };
        for (let u = 0; u < n; u++) { outer = true; if (safe(u, null)) res.push(u); outer = false; }
        outer = true; cur = -1; activeEdge = null; badEdge = null;
        snap("完成", `安全的点是 [${res.join(", ")}]。`, view(), {
          at: "done",
          kind: "ok",
          ans: res.slice(),
          facts: [["当前点", "—", prevCur], ["已确认安全", res.length], ["结果", `[${res.join(", ")}]`]],
        });
      },
    },
  }],
};
