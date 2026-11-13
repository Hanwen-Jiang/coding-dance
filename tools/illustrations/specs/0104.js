module.exports = {
  id: 104, name: "二叉树的最大深度", title: "二叉树的最大深度图解", level: "简单", topic: "二叉树",
  h1: "二叉树的最大深度，问问左右孩子再加一",
  lede: "一棵树的深度，等于左右两棵子树里较深的那个再加上根节点这一层。每个节点都只问左右孩子各自有多深，然后把较大的加 1 报给上一层。",
  hints: [
    { t: "把问题缩小", body: ["整棵树的最大深度 = <code>max(左子树的深度, 右子树的深度) + 1</code>。", "左右子树的深度是同样的问题，只是规模更小，可以递归。"] },
    { t: "递归的终点", body: ["空节点的深度是 0。", "叶子节点的两个孩子都是空，所以它的深度是 <code>max(0, 0) + 1 = 1</code>。"] },
    { t: "另一种思路", body: ["用层序遍历（BFS）一层层往下走，数一共走了多少层。"] },
  ],
  codes: [{ t: "标准解法：递归", code: `
class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        if not root:
            return 0
        return max(self.maxDepth(root.left), self.maxDepth(root.right)) + 1
` }],
  pytest: `
s = Solution()
assert s.maxDepth(T([3,9,20,None,None,15,7])) == 3
assert s.maxDepth(T([1,None,2])) == 2
assert s.maxDepth(T([])) == 0
`,
  legend: [["e", "在调用栈上"], ["a", "当前节点"], ["c", "已经算出深度"]],
  presets: [
    { label: "示例 1", args: { t: [3, 9, 20, null, null, 15, 7] }, note: "root = [3,9,20,null,null,15,7]", expect: 3 },
    { label: "左边更深", args: { t: [1, 2, 3, 4, null, null, null, 5] }, note: "root = [1,2,3,4,null,null,null,5]", expect: 4 },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const dep = {}, stack = [];
    const view = (cur) => { const cls = {}; for (const id in N) cls[id] = +id === cur ? "a" : id in dep ? "c" : stack.includes(+id) ? "e" : ""; const b = {}; for (const id in dep) b[id] = "深度 " + dep[id]; return [{ t: "tree", nodes: N, root: 0, cls, on: stack.slice(), badges: b }]; };
    snap("开始", "每个节点下方会标出它这棵子树的深度。空节点的深度是 0。", view(-1));
    const dfs = (id) => {
      const nd = N[id]; stack.push(id);
      if (nd.l !== null || nd.r !== null) snap("进入", `进入 ${nd.v}，先分别问左右子树的深度。`, view(id));
      const L = nd.l !== null ? dfs(nd.l) : 0, R = nd.r !== null ? dfs(nd.r) : 0;
      dep[id] = Math.max(L, R) + 1;
      snap("算出深度", nd.l === null && nd.r === null ? `${nd.v} 是叶子，左右都是空（深度 0），所以它的深度是 0 + 1 = <b>1</b>。` : `${nd.v}：左子树深度 ${L}，右子树深度 ${R}。取较大的再加 1，得到 <b>${dep[id]}</b>。`, view(id));
      stack.pop();
      return dep[id];
    };
    const ans = dfs(0);
    snap("完成", `根节点的深度是 <b>${ans}</b>，这就是整棵树的最大深度。`, view(-1), { kind: "ok", ans });
  },
  points: [
    { t: "空树返回 0", body: "根节点为空时深度是 0，这也是递归的终止条件。" },
    { t: "这是后序遍历", body: "先拿到左右子树的结果，再算自己的。很多树的题都是这个结构。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)。空间是树的高度。" },
  ],
};
