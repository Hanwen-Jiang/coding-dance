const F = require("../fig");

module.exports = {
  id: 124, name: "二叉树中的最大路径和", title: "二叉树中的最大路径和图解", level: "困难", topic: "二叉树",
  h1: "最大路径和，返回一条链，更新一个拐弯",
  lede: "任何一条路径都有一个最高点：从它往左下走一条链、往右下走一条链。所以递归函数返回「从这个节点往下走一条链的最大和」，而在每个节点顺便算一下「以它为最高点、左右两条链拼起来」的和，更新全局答案。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "exx1.jpg": [F.tree([1, 2, 3], { label: "最优路径 2 → 1 → 3，和为 6", cls: () => "e" })],
    "exx2.jpg": [F.tree([-10, 9, 20, null, null, 15, 7], { label: "最优路径 15 → 20 → 7，和为 42", cls: { 20: "e", 15: "e", 7: "e" } })],
  },
  hints: [
    { t: "路径长什么样", body: ["一条路径有唯一的最高点。从最高点出发，左边往下一条链，右边往下一条链（都可以为空）。"] },
    { t: "递归函数返回什么", body: ["<code>gain(node)</code>：从 <code>node</code> 出发往下走一条链，能拿到的最大和。", "它等于 <code>node.val + max(左链, 右链)</code>，因为往上交的只能是一条链，不能拐弯。", "子链是负数时不如不要，按 0 算。"] },
    { t: "答案在哪里更新", body: ["在每个节点算 <code>node.val + 左链 + 右链</code>，这是以它为最高点的最大路径和，用它更新全局答案。", "答案初始化为负无穷，因为可能所有节点都是负数。"] },
  ],
  codes: [{ t: "标准解法：后序递归", code: `
class Solution:
    def maxPathSum(self, root: Optional[TreeNode]) -> int:
        best = float("-inf")             #@init

        def gain(node):                     # 从 node 往下一条链的最大和
            nonlocal best
            if not node:
                return 0
            l = max(gain(node.left), 0)     # 负的就不要了 #@node
            r = max(gain(node.right), 0)    #@node
            best = max(best, node.val + l + r)  # 以 node 为最高点的路径 #@node
            return node.val + max(l, r)     # 往上只能带一条链 #@node

        gain(root)                          #@init
        return best                         #@done
` }, { t: "简洁写法：返回二元组", kind: "elegant", note: "不用 nonlocal，递归同时返回「往下一条链的最大和」和「子树里的最大路径和」。", code: `
class Solution:
    def maxPathSum(self, root: Optional[TreeNode]) -> int:
        def dfs(node):
            if not node:
                return 0, float("-inf")
            (lc, lb), (rc, rb) = dfs(node.left), dfs(node.right)
            lc, rc = max(lc, 0), max(rc, 0)
            return node.val + max(lc, rc), max(lb, rb, node.val + lc + rc)
        return dfs(root)[1]
` }],
  sig: { fn: "maxPathSum", params: ["TreeNode"], ret: "int" },
  call: (a, H) => [H.toLc(a.t)],
  cases: [[[-3]], [[2, -1]], [[1, -2, 3]], [[-1, -2, -3]], [[5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]]],
  pytest: `
s = Solution()
assert s.maxPathSum(T([1,2,3])) == 6
assert s.maxPathSum(T([-10,9,20,None,None,15,7])) == 42
assert s.maxPathSum(T([-3])) == -3
assert s.maxPathSum(T([2,-1])) == 2
assert s.maxPathSum(T([5,4,8,11,None,13,4,7,2,None,None,None,1])) == 48
`,
  legend: [["e", "在调用栈上"], ["a", "当前节点"], ["c", "已经算完（下面标的是往上交的链和）"], ["k", "最大路径"]],
  presets: [
    { label: "示例 1", args: { t: [1, 2, 3] }, note: "root = [1,2,3]", expect: 6 },
    { label: "示例 2", args: { t: [-10, 9, 20, null, null, 15, 7] }, note: "root = [-10,9,20,null,null,15,7]", expect: 42 },
  ],
  build(a, snap) {
    const N = {};
    a.t.forEach((v, i) => {
      if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
    });
    const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
    const stack = [], upVal = {}, badges = {}, done = new Set();
    let best = -Infinity, bestSet = [], bestEdges = [];
    // 从 id 往下沿着「往上交的链」走，得到这条链上的节点
    const sub = (id) => {
      const out = [id];
      let c = id;
      while (true) {
        const nd = N[c];
        const gl = nd.l !== null ? Math.max(upVal[nd.l], 0) : 0;
        const gr = nd.r !== null ? Math.max(upVal[nd.r], 0) : 0;
        const nx = gl >= gr ? (gl > 0 ? nd.l : null) : nd.r;
        if (nx === null) break;
        out.push(nx);
        c = nx;
      }
      return out;
    };
    const subEdges = (id) => {
      const chain = sub(id), edges = [];
      for (let i = 0; i + 1 < chain.length; i++) edges.push([chain[i], chain[i + 1]]);
      return edges;
    };
    const stackEdges = (extraNode = -1) => {
      const path = extraNode >= 0 && stack[stack.length - 1] !== extraNode ? [...stack, extraNode] : stack;
      const edges = [];
      for (let i = 0; i + 1 < path.length; i++) edges.push([path[i], path[i + 1]]);
      return edges;
    };
    const view = (cur, opts = {}) => {
      const cls = {};
      for (const id in N) {
        const nid = +id;
        cls[id] = opts.fin && bestSet.includes(nid) ? "k" : nid === cur ? "a" : opts.showBest && bestSet.includes(nid) ? "k" : done.has(nid) ? "c" : stack.includes(nid) ? "e" : "";
      }
      return [{
        t: "tree",
        label: "二叉树（向下递归，向上返回最大单链）",
        nodes: snapNodes(),
        root: N[0] ? 0 : null,
        cls,
        directed: true,
        lrLabels: true,
        on: stack.slice(),
        ptrs: cur >= 0 ? { node: cur } : {},
        onEdges: opts.onEdges || stackEdges(cur),
        badges: { ...badges },
      }];
    };
    const fmtBest = (x) => (x === -Infinity ? "−∞" : x);
    let prevNodeVal;
    snap("开始", "后序遍历：先算左右子树往下的链，再算以当前节点为最高点的路径。", view(-1), {
      at: "init",
      facts: [["目前最大 best", "−∞"]],
    });
    const gain = (id) => {
      if (id === null || !N[id]) return 0;
      const nd = N[id], v = nd.v;
      stack.push(id);
      if (nd.l !== null || nd.r !== null) {
        snap(`深入 ${v}`, `到达 <b>${v}</b>，先递归计算它的左右子树能往上提供的最大链和。`, view(id), {
          at: "node",
          facts: [["当前节点", v, prevNodeVal], ["目前最大 best", fmtBest(best)]],
        });
        prevNodeVal = v;
      }
      const l = Math.max(gain(nd.l), 0), r = Math.max(gain(nd.r), 0);
      const through = v + l + r, up = v + Math.max(l, r);
      const prevBest = best, improved = through > best;
      if (improved) {
        best = through;
        bestSet = [id];
        bestEdges = [];
        if (l > 0) { bestSet.push(...sub(nd.l)); bestEdges.push([id, nd.l], ...subEdges(nd.l)); }
        if (r > 0) { bestSet.push(...sub(nd.r)); bestEdges.push([id, nd.r], ...subEdges(nd.r)); }
      }
      upVal[id] = up;
      badges[id] = `↑${up}`;
      done.add(id);
      stack.pop();
      const activeEdges = [...stackEdges(id), ...(improved ? bestEdges : [])];
      const facts = [
        ["当前节点", v, prevNodeVal],
        ["左链 / 右链", `${l} / ${r}`],
        ["拐弯路径和", through],
        improved ? ["目前最大 best", best, fmtBest(prevBest)] : ["目前最大 best", fmtBest(best)],
      ];
      prevNodeVal = v;
      snap(
        `节点 ${v}`,
        `左链 ${l}，右链 ${r}（负的按 0 算）。以 <b>${v}</b> 为最高点的路径和是 ${v} + ${l} + ${r} = <b>${through}</b>${improved ? `，刷新最大路径和为 <b>${best}</b>！` : "。"}往上只能带一条链：${v} + max(${l}, ${r}) = ${up}。`,
        view(id, { showBest: improved, onEdges: activeEdges }),
        { at: "node", facts },
      );
      return up;
    };
    gain(N[0] ? 0 : null);
    snap("完成", `最大路径和是 <b>${best}</b>（高亮为最优路径）。`, view(-1, { fin: true, onEdges: bestEdges }), {
      at: "done",
      kind: "ok",
      ans: best,
      facts: [["目前最大 best", best]],
    });
  },
  points: [
    { t: "返回值和答案不是一回事", body: "返回值是一条链（不能拐弯），答案是一条路径（可以在最高点拐弯）。这是这道题最容易混的地方。" },
    { t: "和 0 取 max", body: "子链为负时直接舍弃，相当于路径在这里停下。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)；递归深度是树高。" },
  ],
};
