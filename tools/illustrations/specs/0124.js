module.exports = {
  id: 124, name: "二叉树中的最大路径和", title: "二叉树中的最大路径和图解", level: "困难", topic: "二叉树",
  h1: "最大路径和，返回一条链，更新一个拐弯",
  lede: "任何一条路径都有一个最高点：从它往左下走一条链、往右下走一条链。所以递归函数返回「从这个节点往下走一条链的最大和」，而在每个节点顺便算一下「以它为最高点、左右两条链拼起来」的和，更新全局答案。",
  hints: [
    { t: "路径长什么样", body: ["一条路径有唯一的最高点。从最高点出发，左边往下一条链，右边往下一条链（都可以为空）。"] },
    { t: "递归函数返回什么", body: ["<code>gain(node)</code>：从 <code>node</code> 出发往下走一条链，能拿到的最大和。", "它等于 <code>node.val + max(左链, 右链)</code>，因为往上交的只能是一条链，不能拐弯。", "子链是负数时不如不要，按 0 算。"] },
    { t: "答案在哪里更新", body: ["在每个节点算 <code>node.val + 左链 + 右链</code>，这是以它为最高点的最大路径和，用它更新全局答案。", "答案初始化为负无穷，因为可能所有节点都是负数。"] },
  ],
  codes: [{ t: "标准解法：后序递归", code: `
class Solution:
    def maxPathSum(self, root: Optional[TreeNode]) -> int:
        best = float("-inf")

        def gain(node):                     # 从 node 往下一条链的最大和
            nonlocal best
            if not node:
                return 0
            l = max(gain(node.left), 0)     # 负的就不要了
            r = max(gain(node.right), 0)
            best = max(best, node.val + l + r)  # 以 node 为最高点的路径
            return node.val + max(l, r)     # 往上只能带一条链

        gain(root)
        return best
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
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const stack = [], badges = {}, done = new Set(); let best = -Infinity, bestSet = [];
    // 从 id 往下沿着「往上交的链」走，得到这条链上的节点
    const sub = (id) => { const out = [id]; let c = id; while (true) { const nd = N[c], gl = nd.l !== null ? Math.max(badges[nd.l], 0) : 0, gr = nd.r !== null ? Math.max(badges[nd.r], 0) : 0; const nx = gl >= gr ? (gl > 0 ? nd.l : null) : nd.r; if (nx === null) break; out.push(nx); c = nx; } return out; };
    const view = (cur, fin) => { const cls = {}; for (const id in N) cls[id] = fin && bestSet.includes(+id) ? "k" : +id === cur ? "a" : done.has(+id) ? "c" : stack.includes(+id) ? "e" : ""; return [{ t: "tree", nodes: N, root: 0, cls, on: stack.slice(), badges: { ...badges } }]; };
    const f = () => ({ facts: [["目前最大", best === -Infinity ? "−∞" : best]] });
    snap("开始", "后序遍历：先算左右子树往下的链，再算自己。", view(-1), f());
    const gain = (id) => {
      if (id === null || !N[id]) return 0;
      stack.push(id);
      const l = Math.max(gain(N[id].l), 0), r = Math.max(gain(N[id].r), 0), v = N[id].v;
      const through = v + l + r, up = v + Math.max(l, r);
      if (through > best) { best = through; bestSet = [id]; if (l > 0) bestSet.push(...sub(N[id].l)); if (r > 0) bestSet.push(...sub(N[id].r)); }
      badges[id] = up; done.add(id); stack.pop();
      snap(`节点 ${v}`, `左链 ${l}，右链 ${r}（负的按 0 算）。以 ${v} 为最高点的路径和是 ${v} + ${l} + ${r} = <b>${through}</b>。往上交 ${v} + max(${l}, ${r}) = ${up}。`, view(id), f());
      return up;
    };
    gain(0);
    snap("完成", `最大路径和是 <b>${best}</b>。`, view(-1, true), { kind: "ok", ans: best, ...f() });
  },
  points: [
    { t: "返回值和答案不是一回事", body: "返回值是一条链（不能拐弯），答案是一条路径（可以在最高点拐弯）。这是这道题最容易混的地方。" },
    { t: "和 0 取 max", body: "子链为负时直接舍弃，相当于路径在这里停下。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)；递归深度是树高。" },
  ],
};
