module.exports = {
  id: 207, name: "课程表", title: "课程表图解", level: "中等", topic: "图论",
  h1: "课程表，先上没有先修课的",
  lede: "把课程看成图的节点，「先修 b 才能上 a」是一条 b → a 的边。能修完所有课，等价于图里没有环。拓扑排序：每次挑一门先修课都已经上完的课（入度为 0），上完后把它指向的课的入度减一，看最后能不能把所有课都上完。",
  hints: [
    { t: "建图", body: ["<code>[a, b]</code> 表示先上 b 再上 a，建一条边 <code>b → a</code>。", "<code>indeg[a]</code>：课 a 还有几门先修课没上。"] },
    { t: "从入度为 0 的课开始", body: ["入度为 0 的课可以直接上，把它们放进队列。", "上完一门课 b，它指向的每门课 a 入度减一。减到 0 的课也可以上了，入队。"] },
    { t: "怎么判断有环", body: ["环上的课互相等待，入度永远减不到 0，永远不会入队。", "最后数一下上过的课，等于 <code>numCourses</code> 就能修完，否则有环。"] },
  ],
  codes: [{ t: "标准解法：拓扑排序（BFS）", code: `
class Solution:
    def canFinish(self, numCourses: int, prerequisites: List[List[int]]) -> bool:
        graph = [[] for _ in range(numCourses)]     #@init
        indeg = [0] * numCourses            # 还有几门先修课没上 #@init
        for a, b in prerequisites:          # 先上 b 才能上 a #@init
            graph[b].append(a)              #@init
            indeg[a] += 1                   #@init
        q = deque(i for i in range(numCourses) if indeg[i] == 0)    #@init
        done = 0                            #@init
        while q:
            b = q.popleft()                 #@take
            done += 1                       #@take
            for a in graph[b]:              #@take
                indeg[a] -= 1               #@take
                if indeg[a] == 0:           # 先修课都上完了 #@take
                    q.append(a)             #@take
        return done == numCourses           # 环上的课永远上不了 #@done
` }, { t: "简洁写法：DFS 三色标记", key: "dfs", kind: "elegant", note: "1 表示这门课还在当前的递归路径上。沿着先修关系走，又碰到了路径上的课，就说明有环。", code: `
class Solution:
    def canFinish(self, numCourses: int, prerequisites: List[List[int]]) -> bool:
        graph = defaultdict(list)           #@init
        for a, b in prerequisites:          #@init
            graph[a].append(b)              #@init
        state = [0] * numCourses            # 0 没访问，1 在递归路径上，2 确认没问题 #@init
        def ok(u):
            if state[u]:                    #@seen,cycle
                return state[u] == 2        #@seen,cycle
            state[u] = 1                    #@enter
            if not all(ok(v) for v in graph[u]):    #@enter
                return False                #@cycle
            state[u] = 2                    #@confirm
            return True                     #@confirm
        return all(ok(u) for u in range(numCourses))    #@init,done
` }],
  sig: { fn: "canFinish", params: ["int", "int[][]"], ret: "bool" },
  call: (a) => [a.n, a.pre],
  cases: [[1, []], [2, [[1, 0]]], [2, [[1, 0], [0, 1]]], [3, [[0, 1], [1, 2], [2, 0]]], [3, [[1, 1]]], [5, [[1, 0], [2, 1], [3, 2], [4, 3]]]],
  pytest: `
s = Solution()
assert s.canFinish(2, [[1,0]]) is True
assert s.canFinish(2, [[1,0],[0,1]]) is False
assert s.canFinish(4, [[1,0],[2,0],[3,1],[3,2]]) is True
assert s.canFinish(3, [[0,1],[1,2],[2,0]]) is False
assert s.canFinish(1, []) is True
`,
  method: "拓扑排序 BFS",
  legend: [["a", "刚上完的课"], ["e", "在队列里"], ["c", "已经上过"], ["w", "永远上不了"]],
  presets: [
    { label: "能修完", args: { n: 4, pre: [[1, 0], [2, 0], [3, 1], [3, 2]] }, note: "numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]", expect: true },
    { label: "有环", args: { n: 4, pre: [[1, 0], [2, 1], [3, 2], [1, 3]] }, note: "numCourses = 4, prerequisites = [[1,0],[2,1],[3,2],[1,3]]", expect: false },
  ],
  build(a, snap) {
    const n = a.n, g = Array.from({ length: n }, () => []), indeg = Array(n).fill(0);
    for (const [x, y] of a.pre) { g[y].push(x); indeg[x]++; }
    const q = [], taken = [];
    const view = (cur, fin, opts = {}) => {
      const prevIndeg = opts.prevIndeg || {};
      const nodeCls = (k) => (k === cur ? "a" : taken.includes(k) ? "c" : q.includes(k) ? "e" : fin ? "w" : "");
      return [
        {
          t: "net",
          label: "先修图（b → a：先上 b 才能上 a；虚线×表示依赖解除）",
          directed: true,
          nodes: Array.from({ length: n }, (_, k) => ({ v: k, cls: nodeCls(k) })),
          edges: a.pre.map(([x, y]) => [y, x, y === cur ? "cut" : taken.includes(y) ? "dim" : fin && !taken.includes(y) ? "warm" : ""]),
          badges: indeg.map((d, k) => (taken.includes(k) ? "已上" : `入度 ${d}`)),
        },
        {
          t: "array",
          label: "indeg（每门课还差几门先修课）",
          items: indeg.map((d, k) => ({
            v: d,
            ...(prevIndeg[k] !== undefined ? { prev: prevIndeg[k] } : {}),
            cls: nodeCls(k),
          })),
          ptrs: { b: cur >= 0 ? cur : null },
        },
        { t: "chips", label: "队列（左边先出）", items: q.slice(), empty: "空" },
      ];
    };
    for (let i = 0; i < n; i++) if (!indeg[i]) q.push(i);
    snap("开始", `入度为 0 的课 ${q.length ? q.join("、") : "没有"} 没有先修课，可以直接上，放进队列。`, view(-1, false), {
      at: "init",
      facts: [["已上课", 0], ["剩余", n], ["队列长度", q.length]],
    });
    while (q.length) {
      const prevTaken = taken.length, prevQ = q.length;
      const b = q.shift();
      taken.push(b);
      const freed = [], prevIndeg = {};
      for (const x of g[b]) {
        prevIndeg[x] = indeg[x];
        indeg[x]--;
        if (!indeg[x]) { q.push(x); freed.push(x); }
      }
      snap(
        `上课 ${b}`,
        `上完课 ${b}。` + (g[b].length ? `它是 ${g[b].join("、")} 的先修课，解除对应依赖边，这些课的入度各减一。` : "没有课依赖它。") + (freed.length ? `${freed.join("、")} 的入度变成 0，入队。` : ""),
        view(b, false, { prevIndeg }),
        {
          at: "take",
          facts: [
            ["已上课", taken.length, prevTaken],
            ["剩余", n - taken.length, n - prevTaken],
            ["队列长度", q.length, prevQ],
          ],
        },
      );
    }
    const ok = taken.length === n;
    snap(
      "完成",
      ok ? `${n} 门课全部上完，返回 <b>true</b>。` : `队列空了，只上了 ${taken.length} 门。剩下的 ${indeg.map((_, k) => k).filter((k) => !taken.includes(k)).join("、")} 在环上，互相等待，入度永远减不到 0，返回 <b>false</b>。`,
      view(-1, true),
      {
        at: "done",
        kind: ok ? "ok" : "warn",
        ans: ok,
        facts: [["已上课", taken.length], ["剩余", n - taken.length], ["结果", ok ? "true" : "false"]],
      },
    );
  },
  alts: [{
    t: "DFS 三色标记",
    code: "dfs",
    note: "和简洁写法一样：从一门课出发，沿着「要先上哪门」一路往下走。state 为 1 表示这门课还在当前的递归路径上，又走回了路径上的课，就说明有环。",
    legend: [["a", "当前的课 / 正在检查的边"], ["e", "1：在递归路径上"], ["c", "2：确认没问题"], ["w", "绕回来的课 / 环边"]],
    build(a, snap) {
      const n = a.n, g = Array.from({ length: n }, () => []);
      for (const [x, y] of a.pre) g[x].push(y);
      const state = Array(n).fill(0), path = [];
      let edge = null, bad = -1, confirmed = 0;
      const view = (cur, opts = {}) => {
        const prevState = opts.prevState || {};
        const pathEdge = (x, y) => {
          const i = path.indexOf(x);
          return i >= 0 && path[i + 1] === y;
        };
        const nodeCls = (k) => (k === bad ? "w" : k === cur ? "a" : state[k] === 1 ? "e" : state[k] === 2 ? "c" : "");
        return [
          {
            t: "net",
            label: "依赖图（a → b：上 a 之前要先上 b）",
            directed: true,
            nodes: Array.from({ length: n }, (_, k) => ({
              v: k,
              ...(prevState[k] !== undefined ? { prev: prevState[k] } : {}),
              cls: nodeCls(k),
            })),
            edges: a.pre.map(([x, y]) => {
              const isCur = edge && edge[0] === x && edge[1] === y;
              return [x, y, bad >= 0 && isCur ? "warm" : isCur ? "on draw" : pathEdge(x, y) ? "on" : state[x] === 2 ? "dim" : ""];
            }),
            badges: state.map((s) => (s === 2 ? "2:安全" : s === 1 ? "1:在栈" : "0:未访")),
          },
          {
            t: "array",
            label: "state（0 没访问，1 在递归路径上，2 确认没问题）",
            items: state.map((s, k) => ({
              v: s,
              ...(prevState[k] !== undefined ? { prev: prevState[k] } : {}),
              cls: nodeCls(k),
            })),
            ptrs: { u: cur >= 0 ? cur : null },
          },
          { t: "chips", label: "递归路径", items: path.map((u) => ({ v: `课 ${u}`, cls: u === bad ? "w" : u === cur ? "a" : "e" })), empty: "空" },
        ];
      };
      const ok = (u) => {
        const prevLen = path.length;
        state[u] = 1; path.push(u);
        snap(
          "进入",
          `进入课 ${u}，state[${u}] 从 0 标成 1。` + (g[u].length ? `上它之前要先上 ${g[u].join("、")}，挨个检查。` : "它没有先修课。"),
          view(u, { prevState: { [u]: 0 } }),
          { at: "enter", facts: [["当前课", u], ["已确认", confirmed], ["路径长度", path.length, prevLen]] },
        );
        for (const v of g[u]) {
          edge = [u, v];
          if (state[v] === 1) {
            bad = v;
            snap(
              "有环",
              `课 ${u} 要先上课 ${v}，可是 ${v} 还在当前的递归路径上：${path.slice(path.indexOf(v)).join(" → ")} → ${v} 绕成了一个环，这些课互相等待。返回 false。`,
              view(u),
              { at: "cycle", kind: "warn", facts: [["当前课", u], ["发现环", `${u}→${v}`], ["路径长度", path.length]] },
            );
            return false;
          }
          if (state[v] === 2) {
            snap(
              "已确认",
              `课 ${u} 要先上课 ${v}，${v} 之前已经确认没问题（state = 2），跳过。`,
              view(u),
              { at: "seen", facts: [["当前课", u], ["跳过", `课 ${v}(安全)`], ["路径长度", path.length]] },
            );
            continue;
          }
          if (!ok(v)) return false;
        }
        edge = null;
        state[u] = 2;
        path.pop();
        confirmed++;
        snap(
          "确认",
          `课 ${u} 的先修课都没问题，state[${u}] 从 1 标成 2，离开递归路径。`,
          view(u, { prevState: { [u]: 1 } }),
          { at: "confirm", facts: [["当前课", u], ["已确认", confirmed, confirmed - 1], ["路径长度", path.length, path.length + 1]] },
        );
        return true;
      };
      snap("开始", "所有课的 state 都是 0。从课 0 开始，依次把每门没访问过的课当起点做 DFS。", view(-1), {
        at: "init",
        facts: [["当前课", "—"], ["已确认", 0], ["路径长度", 0]],
      });
      for (let u = 0; u < n; u++) {
        if (state[u]) continue;
        if (!ok(u)) {
          snap("完成", "找到了环，环上的课永远上不完，返回 <b>false</b>。", view(-1), {
            at: "done",
            kind: "warn",
            ans: false,
            facts: [["已确认", confirmed], ["总数", n], ["结果", "false"]],
          });
          return;
        }
      }
      snap("完成", `所有课都标成了 2，没有环，${n} 门课都能上完，返回 <b>true</b>。`, view(-1), {
        at: "done",
        kind: "ok",
        ans: true,
        facts: [["已确认", confirmed], ["总数", n], ["结果", "true"]],
      });
    },
  }],
  points: [
    { t: "边的方向", body: "[a, b] 是先 b 后 a，边从 b 指向 a，入度加在 a 上。方向反了也能判环，但拓扑序就反了。" },
    { t: "DFS 要三种状态", body: "只用「访问过」两种状态分不清「在当前路径上」和「已经确认没问题」，会误判有环。" },
    { t: "复杂度", body: "每个点、每条边各处理一次，时间 O(V + E)，空间 O(V + E)。" },
  ],
};
