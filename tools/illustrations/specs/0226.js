module.exports = {
  id: 226, name: "翻转二叉树", title: "翻转二叉树图解", level: "简单", topic: "二叉树",
  h1: "翻转二叉树，每个节点都把左右孩子换一下",
  lede: "把整棵树左右镜像，听起来是对整棵树的操作，其实只要在每个节点上做同一件小事：交换它的左孩子和右孩子。所有节点都换完，整棵树就翻过来了。",
  hints: [
    { t: "只看一个节点", body: ["对一个节点来说，翻转就是把 <code>left</code> 和 <code>right</code> 两个指针交换。", "交换的是指针，所以整棵子树会跟着一起搬到另一边。"] },
    { t: "每个节点都要做", body: ["交换完当前节点，再分别去翻转它的两个孩子。先交换再递归，或者先递归再交换，都可以。"] },
    { t: "递归的终点", body: ["节点为空时直接返回。"] },
  ],
  codes: [{ t: "标准解法：递归", code: `
class Solution:
    def invertTree(self, root: Optional[TreeNode]) -> Optional[TreeNode]:
        if not root:
            return None
        root.left, root.right = root.right, root.left   # 交换左右孩子
        self.invertTree(root.left)
        self.invertTree(root.right)
        return root
` }],
  pytest: `
s = Solution()
assert toT(s.invertTree(T([4,2,7,1,3,6,9]))) == [4,7,2,9,6,3,1]
assert toT(s.invertTree(T([2,1,3]))) == [2,3,1]
assert toT(s.invertTree(T([]))) == []
assert toT(s.invertTree(T([1,2]))) == [1,None,2]
`,
  legend: [["a", "正在交换孩子的节点"], ["c", "已经交换完"]],
  presets: [
    { label: "示例 1", args: { t: [4, 2, 7, 1, 3, 6, 9] }, note: "root = [4,2,7,1,3,6,9]", expect: [4, 7, 2, 9, 6, 3, 1] },
    { label: "不对称的树", args: { t: [1, 2, 3, 4, null, null, 5] }, note: "root = [1,2,3,4,null,null,5]", expect: [1, 3, 2, 5, 4] },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const done = new Set();
    const snapTree = () => { const c = {}; for (const id in N) c[id] = { ...N[id] }; return c; };
    const view = (cur) => { const cls = {}; for (const id in N) cls[id] = +id === cur ? "a" : done.has(+id) ? "c" : ""; return [{ t: "tree", nodes: snapTree(), root: 0, cls }]; };
    const nm = (id) => (id === null ? "空" : N[id].v);
    snap("开始", "从根节点开始，对每个节点交换它的左右孩子。", view(-1));
    const dfs = (id) => {
      const nd = N[id];
      if (nd.l === null && nd.r === null) { done.add(id); return; }
      snap("准备交换", `${nd.v} 的左孩子是 ${nm(nd.l)}，右孩子是 ${nm(nd.r)}。`, view(id));
      [nd.l, nd.r] = [nd.r, nd.l]; done.add(id);
      snap("交换", `交换之后，左孩子是 ${nm(nd.l)}，右孩子是 ${nm(nd.r)}。两棵子树整体换了位置。`, view(id));
      if (nd.l !== null) dfs(nd.l);
      if (nd.r !== null) dfs(nd.r);
    };
    dfs(0);
    const out = [], q = [0];
    while (q.length) { const id = q.shift(); out.push(N[id].v); if (N[id].l !== null) q.push(N[id].l); if (N[id].r !== null) q.push(N[id].r); }
    snap("完成", `每个节点都交换过了，整棵树左右镜像。按层读出来是 [${out.join(", ")}]。`, view(-1), { kind: "ok", ans: out });
  },
  points: [
    { t: "交换的是指针", body: "不是交换两个孩子的值。交换值的话，孙子节点还留在原来那一边。" },
    { t: "叶子节点", body: "叶子的两个孩子都是空，交换了也没变化，递归下去会马上返回。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)。" },
  ],
};
