const F = require("../fig");

module.exports = {
  id: 437, name: "路径总和 III", title: "路径总和 III图解", level: "中等", topic: "二叉树",
  h1: "路径总和 III，树上的前缀和",
  lede: "从根往下走到某个节点，路上的和叫做前缀和。一条向下的路径的和，等于两个前缀和之差。所以走到一个节点时，只要问：从根到这里的路上，有几个前缀和等于「当前前缀和 − targetSum」？和第 560 题和为 K 的子数组是同一个思路，只是要在离开节点时撤销。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "pathsum3-1-tree.jpg": [F.tree([10, 5, -3, 3, 2, null, 11, 3, -2, null, 1], { label: "和为 8 的三条路径：5 → 3、5 → 2 → 1（蓝色）、-3 → 11（紫色）", cls: (v, i) => ([1, 3, 4, 10].includes(i) ? "e" : i === 2 || i === 6 ? "g" : "") })],
  },
  hints: [
    { t: "路径和 = 前缀和之差", body: ["记 <code>cur</code> 为从根到当前节点的和。如果从根到某个祖先的和是 <code>cur - targetSum</code>，那么从这个祖先的下一个节点到当前节点，和正好是 <code>targetSum</code>。"] },
    { t: "用哈希表计数", body: ["<code>cnt[s]</code>：从根到当前节点的路径上，前缀和 <code>s</code> 出现了几次。", "初始化 <code>cnt[0] = 1</code>，表示从根开始的路径。"] },
    { t: "离开节点时要撤销", body: ["哈希表里只能有当前路径上的前缀和。递归完左右子树后，把 <code>cnt[cur]</code> 减一，否则别的分支会错误地用到它。"] },
  ],
  codes: [{ t: "标准解法：前缀和 + 哈希表 + 回溯", code: `
class Solution:
    def pathSum(self, root: Optional[TreeNode], targetSum: int) -> int:
        cnt = defaultdict(int)              #@init
        cnt[0] = 1                          # 空前缀：路径从根开始 #@init

        def dfs(node, cur):
            if not node:
                return 0
            cur += node.val                 # 根到 node 的前缀和 #@visit
            res = cnt[cur - targetSum]      # 前面有几个前缀和差正好是 targetSum #@visit
            cnt[cur] += 1
            res += dfs(node.left, cur) + dfs(node.right, cur)
            cnt[cur] -= 1                   # 回溯：离开这条路径
            return res

        return dfs(root, 0)                 #@init,done
` }, { t: "简洁写法：双重递归", key: "double", kind: "elegant", note: "每个节点都当一次起点，往下数和为 target 的路径。时间 O(n²)，n ≤ 1000 也能过，胜在好写。", code: `
class Solution:
    def pathSum(self, root: Optional[TreeNode], targetSum: int) -> int:
        def down(node, t):                  # 从 node 开始往下、和为 t 的路径数
            if not node:
                return 0
            return (node.val == t) + down(node.left, t - node.val) + down(node.right, t - node.val)    #@down
        if not root:                        #@empty
            return 0                        #@empty
        return down(root, targetSum) + self.pathSum(root.left, targetSum) + self.pathSum(root.right, targetSum)    #@start,done
` }],
  sig: { fn: "pathSum", params: ["TreeNode", "int"], ret: "int" },
  call: (a, H) => [H.toLc(a.t), a.target],
  cases: [[[], 0], [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1], 22], [[0, 1, 1], 1], [[1, -2, -3, 1, 3, -2, null, -1], -1], [[1000000000, 1000000000, null, 294967296, null, 1000000000, null, 1000000000, null, 1000000000], 0]],
  pytest: `
s = Solution()
assert s.pathSum(T([10,5,-3,3,2,None,11,3,-2,None,1]), 8) == 3
assert s.pathSum(T([5,4,8,11,None,13,4,7,2,None,None,5,1]), 22) == 3
assert s.pathSum(T([]), 0) == 0
assert s.pathSum(T([1,2,3]), 3) == 2
assert s.pathSum(T([0,1,1]), 1) == 4
`,
  method: "前缀和 + 哈希表",
  legend: [["e", "当前路径上的节点"], ["a", "当前节点"], ["c", "以它结尾有满足条件的路径"]],
  presets: [
    { label: "示例 1", args: { t: [10, 5, -3, 3, 2, null, 11, 3, -2, null, 1], target: 8 }, note: "root = [10,5,-3,3,2,null,11,3,-2,null,1], targetSum = 8", expect: 3 },
    { label: "小一点", args: { t: [1, 2, 3], target: 3 }, note: "root = [1,2,3], targetSum = 3", expect: 2 },
  ],
  build(a, snap) {
    const N = {};
    a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
    const T = a.target, cnt = { 0: 1 }, path = [], pathSums = [0], badges = {}, hitSet = new Set(), winEdgeMap = new Map();
    let total = 0;
    const pathEdges = (arr) => {
      const edges = [];
      for (let i = 0; i + 1 < arr.length; i++) edges.push([arr[i], arr[i + 1]]);
      return edges;
    };
    const view = (cur, opts = {}) => {
      const cls = {};
      for (const id in N) cls[id] = +id === cur ? "a" : hitSet.has(+id) ? "c" : path.includes(+id) ? "e" : "";
      return [
        {
          t: "tree",
          nodes: snapNodes(),
          root: N[0] ? 0 : null,
          cls,
          directed: true,
          lrLabels: true,
          on: path.slice(),
          onEdges: opts.onEdges !== undefined ? opts.onEdges : pathEdges(path),
          ptrs: { cur: cur >= 0 ? cur : null },
          badges: { ...badges },
        },
        { t: "chips", label: "当前路径上的前缀和（前缀和 × 次数）", items: Object.entries(cnt).filter(([, c]) => c > 0).map(([k, c]) => `${k} × ${c}`), empty: "空" },
      ];
    };
    const f = (at, extra = []) => ({ at, facts: [["targetSum", T], ...extra] });
    if (!N[0]) {
      snap("完成", "树是空的，没有路径。", [{ t: "note", label: "树", html: "空" }], { kind: "ok", ans: 0, ...f("done", [["找到", 0]]) });
      return;
    }
    snap("开始", `节点下面标的是从根到它的前缀和。哈希表里先放一个前缀和 0，表示路径可以从根开始。`, view(-1), f("init", [["找到", 0]]));
    const dfs = (id, cur) => {
      if (id === null || !N[id]) return;
      cur += N[id].v; path.push(id); pathSums.push(cur); badges[id] = "和 " + cur;
      const c = cnt[cur - T] || 0, prevTotal = total;
      total += c;
      if (c) {
        hitSet.add(id);
        for (let j = 0; j < path.length; j++) {
          if (pathSums[j] === cur - T) {
            for (let m = j; m + 1 < path.length; m++) {
              winEdgeMap.set(`${path[m]}->${path[m + 1]}`, [path[m], path[m + 1]]);
            }
          }
        }
      }
      snap(
        `节点 ${N[id].v}`,
        `前缀和是 ${cur}。要找前缀和 ${cur} − ${T} = ${cur - T}，路径上有 <b>${c}</b> 个` + (c ? `，说明有 ${c} 条以 ${N[id].v} 结尾的路径和为 ${T}。` : "。"),
        view(id),
        { ...(c ? { kind: "ok" } : {}), ...f("visit", [["当前前缀和", cur], ["需要找", cur - T], ["找到", total, prevTotal]]) },
      );
      cnt[cur] = (cnt[cur] || 0) + 1;
      dfs(N[id].l, cur); dfs(N[id].r, cur);
      cnt[cur]--; path.pop(); pathSums.pop();
    };
    dfs(0, 0);
    snap("完成", `一共有 <b>${total}</b> 条路径的和等于 ${T}。`, view(-1, { onEdges: [...winEdgeMap.values()] }), { kind: "ok", ans: total, ...f("done", [["找到", total]]) });
  },
  alts: [{
    t: "双重递归",
    code: "double",
    note: "和简洁写法一样：外层按前序把每个节点都当一次起点，内层从起点往下走，数和为 targetSum 的路径。每个起点都要把下面的子树走一遍，时间 O(n²)。",
    legend: [["b", "起点（下面写的是从它出发找到几条）"], ["e", "从起点走过来的路径"], ["a", "当前节点"], ["c", "路径和正好等于 targetSum"]],
    build(a, snap) {
      const N = {};
      a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
      const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
      const T = a.target, badges = {}, starts = [], winEdgeMap = new Map();
      let total = 0;
      const pathEdges = (arr) => {
        const edges = [];
        for (let i = 0; i + 1 < arr.length; i++) edges.push([arr[i], arr[i + 1]]);
        return edges;
      };
      const view = (start, path, cur, hit, opts = {}) => {
        const cls = {};
        for (const id in N) { const i = +id; cls[id] = i === cur ? (hit ? "c" : "a") : i === start ? "b" : path.includes(i) ? "e" : ""; }
        const ptrs = {};
        if (start >= 0) ptrs.start = start;
        if (cur >= 0) ptrs.cur = cur;
        return [{
          t: "tree",
          nodes: snapNodes(),
          root: N[0] ? 0 : null,
          cls,
          directed: true,
          lrLabels: true,
          on: path.slice(),
          onEdges: opts.onEdges !== undefined ? opts.onEdges : pathEdges(path),
          ptrs,
          badges: { ...badges },
        }];
      };
      const f = (at, extra = []) => ({ at, facts: [["targetSum", T], ...extra] });
      if (!N[0]) { snap("完成", "树是空的，没有路径。", [{ t: "note", label: "树", html: "空" }], { kind: "ok", ans: 0, ...f("empty", [["找到", 0]]) }); return; }
      snap("开始", "外层递归按前序（根 → 左 → 右）把每个节点都当一次起点；内层从起点往下走，看路径和是不是 targetSum。", view(-1, [], -1, false), f("start", [["找到", 0]]));
      const pre = (id) => { if (id === null || !N[id]) return; starts.push(id); pre(N[id].l); pre(N[id].r); };
      pre(0);
      for (const s of starts) {
        let cnt = 0; const path = [];
        badges[s] = "0 条";
        const down = (id, sum) => {
          if (id === null || !N[id]) return;
          path.push(id); sum += N[id].v;
          const hit = sum === T, prevTotal = total;
          if (hit) {
            cnt++; total++; badges[s] = `${cnt} 条`;
            for (const e of pathEdges(path)) winEdgeMap.set(`${e[0]}->${e[1]}`, e);
          }
          snap(
            `起点 ${N[s].v}`,
            (id === s ? `以 ${N[s].v} 为起点，路径和是 ${sum}。` : `从 ${N[s].v} 往下走到 ${N[id].v}，路径和是 ${sum}。`) + (hit ? `等于 ${T}，找到一条。` : ""),
            view(s, path, id, hit),
            { ...(hit ? { kind: "ok" } : {}), ...f(id === s ? ["start", "down"] : "down", [["当前路径和", sum], ["找到", total, prevTotal]]) },
          );
          down(N[id].l, sum); down(N[id].r, sum);
          path.pop();
        };
        down(s, 0);
      }
      snap("完成", `每个节点都当过一次起点，一共有 <b>${total}</b> 条路径的和等于 ${T}。`, view(-1, [], -1, false, { onEdges: [...winEdgeMap.values()] }), { kind: "ok", ans: total, ...f("done", [["找到", total]]) });
    },
  }],
  points: [
    { t: "先查再加", body: "先查 <code>cnt[cur - target]</code> 再把 <code>cur</code> 加进去，否则 target = 0 时会把空路径算进去。" },
    { t: "回溯撤销", body: "从一个节点返回时 <code>cnt[cur] -= 1</code>，哈希表里只保留当前这条根到节点路径上的前缀和。" },
    { t: "复杂度", body: "每个节点 O(1)，时间 O(n)，空间 O(树高)。" },
  ],
};
