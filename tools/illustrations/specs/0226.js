const F = require("../fig");

module.exports = {
  id: 226, name: "翻转二叉树", title: "翻转二叉树图解", level: "简单", topic: "二叉树",
  h1: "翻转二叉树，每个节点都把左右孩子换一下",
  lede: "把整棵树左右镜像，听起来是对整棵树的操作，其实只要在每个节点上做同一件小事：交换它的左孩子和右孩子。所有节点都换完，整棵树就翻过来了。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "invert1-tree.jpg": [F.row([F.tree([4, 2, 7, 1, 3, 6, 9], { cls: { 2: "e", 1: "e", 3: "e", 7: "g", 6: "g", 9: "g" } }), F.tree([4, 7, 2, 9, 6, 3, 1], { cls: { 2: "e", 1: "e", 3: "e", 7: "g", 6: "g", 9: "g" } })], { label: "每个节点的左右孩子都交换（颜色跟着节点走）" })],
    "invert2-tree.jpg": [F.row([F.tree([2, 1, 3], { cls: { 1: "e", 3: "g" } }), F.tree([2, 3, 1], { cls: { 1: "e", 3: "g" } })], { label: "左右交换" })],
  },
  hints: [
    { t: "只看一个节点", body: ["对一个节点来说，翻转就是把 <code>left</code> 和 <code>right</code> 两个指针交换。", "交换的是指针，所以整棵子树会跟着一起搬到另一边。"] },
    { t: "每个节点都要做", body: ["交换完当前节点，再分别去翻转它的两个孩子。先交换再递归，或者先递归再交换，都可以。"] },
    { t: "递归的终点", body: ["节点为空时直接返回。"] },
  ],
  codes: [{ t: "标准解法：递归", code: `
class Solution:
    def invertTree(self, root: Optional[TreeNode]) -> Optional[TreeNode]:
        if not root:                    #@base
            return None                 #@base
        root.left, root.right = root.right, root.left   # 交换左右孩子 #@swap
        self.invertTree(root.left)      #@rec
        self.invertTree(root.right)     #@rec
        return root                     #@done
` }, { t: "简洁写法：同时赋值", kind: "elegant", code: `
class Solution:
    def invertTree(self, root: Optional[TreeNode]) -> Optional[TreeNode]:
        if root:
            root.left, root.right = self.invertTree(root.right), self.invertTree(root.left)
        return root
` }],
  pytest: `
s = Solution()
assert toT(s.invertTree(T([4,2,7,1,3,6,9]))) == [4,7,2,9,6,3,1]
assert toT(s.invertTree(T([2,1,3]))) == [2,3,1]
assert toT(s.invertTree(T([]))) == []
assert toT(s.invertTree(T([1,2]))) == [1,None,2]
`,
  sig: { fn: "invertTree", params: ["TreeNode"], ret: "TreeNode" },
  call: (a, H) => [H.toLc(a.t)],
  cases: [[[]], [[1, 2]], [[2, 1, 3]], [[-100]]],
  legend: [["a", "正在交换孩子的节点"], ["c", "已经交换完"]],
  presets: [
    { label: "示例 1", args: { t: [4, 2, 7, 1, 3, 6, 9] }, note: "root = [4,2,7,1,3,6,9]", expect: [4, 7, 2, 9, 6, 3, 1] },
    { label: "不对称的树", args: { t: [1, 2, 3, 4, null, null, 5] }, note: "root = [1,2,3,4,null,null,5]", expect: [1, 3, 2, 5, 4] },
  ],
  build(a, snap) {
    const N = {};
    a.t.forEach((v, i) => {
      if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
    });
    const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
    if (!N[0]) {
      snap("完成", "树是空的，不需要翻转。", [{ t: "note", label: "二叉树", html: "空" }], { at: "base", kind: "ok", ans: [] });
      return;
    }
    const done = new Set();
    const childEdges = (id) => {
      const nd = N[id], edges = [];
      if (nd.l !== null) edges.push([id, nd.l]);
      if (nd.r !== null) edges.push([id, nd.r]);
      return edges;
    };
    const view = (cur, opts = {}) => {
      const cls = {};
      for (const id in N) cls[id] = +id === cur ? "a" : done.has(+id) ? "c" : "";
      return [{
        t: "tree",
        label: "二叉树（带 L/R 方向与子树镜像动画）",
        nodes: snapNodes(),
        root: 0,
        cls,
        directed: true,
        lrLabels: true,
        ptrs: cur >= 0 ? { cur } : {},
        onEdges: opts.onEdges || [],
        ...(opts.prevNodes ? { prevNodes: opts.prevNodes } : {}),
      }];
    };
    const nm = (id) => (id === null ? "空" : N[id].v);
    let prevCur;
    snap("开始", "从根节点开始，对每个节点交换它的左右孩子指针。", view(-1), {
      at: [],
      facts: [["已翻转节点", 0]],
    });
    const dfs = (id) => {
      const nd = N[id];
      if (nd.l === null && nd.r === null) {
        done.add(id);
        return;
      }
      const oldL = nd.l, oldR = nd.r;
      const beforeChildren = `${nm(oldL)} / ${nm(oldR)}`;
      snap(
        "准备交换",
        `到达 <b>${nd.v}</b>：左孩子是 ${nm(oldL)}，右孩子是 ${nm(oldR)}。准备交换它的 left 和 right 指针。`,
        view(id, { onEdges: childEdges(id) }),
        {
          at: "base",
          facts: [
            prevCur !== undefined && prevCur !== nd.v ? ["当前节点", nd.v, prevCur] : ["当前节点", nd.v],
            ["左 / 右孩子", beforeChildren],
            ["已翻转节点", done.size],
          ],
        },
      );
      prevCur = nd.v;

      const prevSnap = snapNodes();
      [nd.l, nd.r] = [nd.r, nd.l];
      const prevDoneCount = done.size;
      done.add(id);
      const afterChildren = `${nm(nd.l)} / ${nm(nd.r)}`;
      snap(
        "交换左右子树",
        `交换之后，${nd.v} 的左孩子变成 <b>${nm(nd.l)}</b>，右孩子变成 <b>${nm(nd.r)}</b>。两棵子树整体镜像换位！（可点「重播本步」再看一次）`,
        view(id, { prevNodes: prevSnap, onEdges: childEdges(id) }),
        {
          at: "swap",
          facts: [
            ["当前节点", nd.v],
            ["左 / 右孩子", afterChildren, beforeChildren],
            ["已翻转节点", done.size, prevDoneCount],
          ],
        },
      );

      if (nd.l !== null) {
        const lLeaf = N[nd.l].l === null && N[nd.l].r === null;
        if (lLeaf) done.add(nd.l);
        snap(
          "递归左子树",
          lLeaf ? `沿着新的 left 指针进入左孩子 <b>${N[nd.l].v}</b>，它是叶子节点，直接返回。` : `沿着新的 left 指针递归翻转左子树 <b>${N[nd.l].v}</b>。`,
          view(id, { onEdges: [[id, nd.l]] }),
          { at: "rec", facts: [["当前节点", nd.v], ["递归进入", `左孩子 ${N[nd.l].v}`], ["已翻转节点", done.size]] },
        );
        if (!lLeaf) dfs(nd.l);
      }
      if (nd.r !== null) {
        const rLeaf = N[nd.r].l === null && N[nd.r].r === null;
        if (rLeaf) done.add(nd.r);
        snap(
          "递归右子树",
          rLeaf ? `沿着新的 right 指针进入右孩子 <b>${N[nd.r].v}</b>，它是叶子节点，直接返回。` : `沿着新的 right 指针递归翻转右子树 <b>${N[nd.r].v}</b>。`,
          view(id, { onEdges: [[id, nd.r]] }),
          { at: "rec", facts: [["当前节点", nd.v], ["递归进入", `右孩子 ${N[nd.r].v}`], ["已翻转节点", done.size]] },
        );
        if (!rLeaf) dfs(nd.r);
      }
    };
    dfs(0);
    const out = [], q = [0];
    while (q.length) {
      const id = q.shift();
      out.push(N[id].v);
      if (N[id].l !== null) q.push(N[id].l);
      if (N[id].r !== null) q.push(N[id].r);
    }
    snap("完成", `每个节点都交换过了，整棵树左右镜像。按层读出来是 [${out.join(", ")}]。`, view(-1), {
      at: "done",
      kind: "ok",
      ans: out,
      facts: [["已翻转节点", done.size]],
    });
  },
  points: [
    { t: "交换的是指针", body: "不是交换两个孩子的值。交换值的话，孙子节点还留在原来那一边。" },
    { t: "叶子节点", body: "叶子的两个孩子都是空，交换了也没变化，递归下去会马上返回。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)。" },
  ],
};
