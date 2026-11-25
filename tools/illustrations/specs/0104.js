const F = require("../fig");

module.exports = {
  id: 104, name: "二叉树的最大深度", title: "二叉树的最大深度图解", level: "简单", topic: "二叉树",
  h1: "二叉树的最大深度，问问左右孩子再加一",
  lede: "一棵树的深度，等于左右两棵子树里较深的那个再加上根节点这一层。每个节点都只问左右孩子各自有多深，然后把较大的加 1 报给上一层。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "tmp-tree.jpg": [F.tree([3, 9, 20, null, null, 15, 7], { label: "最深的路径 3 → 20 → 15（或 7），深度 3" })],
  },
  hints: [
    { t: "把问题缩小", body: ["整棵树的最大深度 = <code>max(左子树的深度, 右子树的深度) + 1</code>。", "左右子树的深度是同样的问题，只是规模更小，可以递归。"] },
    { t: "递归的终点", body: ["空节点的深度是 0。", "叶子节点的两个孩子都是空，所以它的深度是 <code>max(0, 0) + 1 = 1</code>。"] },
    { t: "另一种思路", body: ["用层序遍历（BFS）一层层往下走，数一共走了多少层。"] },
  ],
  codes: [{ t: "标准解法：递归", code: `
class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        if not root:                    #@base
            return 0                    #@base
        return max(self.maxDepth(root.left), self.maxDepth(root.right)) + 1   #@down,depth
` }, { t: "简洁写法：一行", kind: "elegant", code: `
class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right)) if root else 0
` }],
  pytest: `
s = Solution()
assert s.maxDepth(T([3,9,20,None,None,15,7])) == 3
assert s.maxDepth(T([1,None,2])) == 2
assert s.maxDepth(T([])) == 0
`,
  sig: { fn: "maxDepth", params: ["TreeNode"], ret: "int" },
  call: (a, H) => [H.toLc(a.t)],
  cases: [[[]], [[1, null, 2]], [[0]], [[1, 2, null, 3, null, 4, null, 5]]],
  legend: [["e", "在调用栈上"], ["a", "当前节点"], ["c", "已经算出深度"]],
  presets: [
    { label: "示例 1", args: { t: [3, 9, 20, null, null, 15, 7] }, note: "root = [3,9,20,null,null,15,7]", expect: 3 },
    { label: "左边更深", args: { t: [1, 2, 3, 4, null, null, null, 5] }, note: "root = [1,2,3,4,null,null,null,5]", expect: 4 },
  ],
  build(a, snap) {
    const N = {};
    a.t.forEach((v, i) => {
      if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
    });
    const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
    if (!N[0]) {
      snap("完成", "空树的深度是 0。", [{ t: "note", label: "二叉树", html: "空" }], { at: "base", kind: "ok", ans: 0, facts: [["最大深度", 0]] });
      return;
    }
    const dep = {}, stack = [], deepChild = {};
    let maxSeen = 0;
    const stackEdges = () => {
      const e = [];
      for (let i = 0; i + 1 < stack.length; i++) e.push([stack[i], stack[i + 1]]);
      return e;
    };
    const bestSubtreeEdges = (startId) => {
      const e = [];
      let p = startId;
      while (p !== null && p !== undefined && deepChild[p] !== null && deepChild[p] !== undefined) {
        e.push([p, deepChild[p]]);
        p = deepChild[p];
      }
      return e;
    };
    const view = (cur, opts = {}) => {
      const cls = {}, b = {};
      for (const id in N) cls[id] = +id === cur ? "a" : id in dep ? "c" : stack.includes(+id) ? "e" : "";
      for (const id in dep) b[id] = "深度 " + dep[id];
      return [{
        t: "tree",
        label: "二叉树最大深度（后序返回 max(左, 右) + 1）",
        nodes: snapNodes(),
        root: 0,
        cls,
        directed: true,
        lrLabels: true,
        on: stack.slice(),
        onEdges: stackEdges().concat(opts.onEdges || []),
        ptrs: { root: cur >= 0 ? cur : null },
        badges: b,
      }];
    };
    snap("开始", "每个节点下方会标出它这棵子树的深度。空节点的深度是 0。", view(-1), {
      at: "base",
      facts: [["调用栈深", 0], ["已算最大深度", 0]],
    });
    const dfs = (id) => {
      const nd = N[id];
      const prevDepth = stack.length;
      stack.push(id);
      if (nd.l !== null || nd.r !== null) {
        snap("进入", `进入 <b>${nd.v}</b>，先分别问左右子树的深度。`, view(id), {
          at: "down",
          facts: [["当前 root", nd.v], ["调用栈深", stack.length, prevDepth], ["已算最大深度", maxSeen]],
        });
      }
      const L = nd.l !== null ? dfs(nd.l) : 0;
      const R = nd.r !== null ? dfs(nd.r) : 0;
      dep[id] = Math.max(L, R) + 1;
      deepChild[id] = L === 0 && R === 0 ? null : L >= R ? nd.l : nd.r;
      const prevMax = maxSeen;
      maxSeen = Math.max(maxSeen, dep[id]);
      const maxFact = maxSeen !== prevMax ? ["已算最大深度", maxSeen, prevMax] : ["已算最大深度", maxSeen];
      snap(
        "算出深度",
        nd.l === null && nd.r === null
          ? `<b>${nd.v}</b> 是叶子，左右都是空（深度 0），所以它的深度是 max(0, 0) + 1 = <b>1</b>。`
          : `<b>${nd.v}</b>：左子树深度 ${L}，右子树深度 ${R}。取较大的再加 1，得到 <b>${dep[id]}</b>。`,
        view(id, { onEdges: bestSubtreeEdges(id) }),
        {
          at: "depth",
          facts: nd.l === null && nd.r === null
            ? [["当前 root", nd.v], ["子树深度", 1], maxFact]
            : [["当前 root", nd.v], ["左 / 右深度", `${L} / ${R}`], ["子树深度", dep[id]], maxFact],
        },
      );
      stack.pop();
      return dep[id];
    };
    const ans = dfs(0);
    snap("完成", `根节点的深度是 <b>${ans}</b>，高亮路径就是最深的一条根到叶路径。`, view(-1, { onEdges: bestSubtreeEdges(0) }), {
      at: "depth",
      kind: "ok",
      ans,
      facts: [["调用栈深", 0], ["最大深度", ans]],
    });
  },
  points: [
    { t: "空树返回 0", body: "根节点为空时深度是 0，这也是递归的终止条件。" },
    { t: "这是后序遍历", body: "先拿到左右子树的结果，再算自己的。很多树的题都是这个结构。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)。空间是树的高度。" },
  ],
};
