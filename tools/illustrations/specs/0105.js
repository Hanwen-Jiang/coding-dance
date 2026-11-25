const F = require("../fig");

module.exports = {
  id: 105, name: "从前序与中序遍历序列构造二叉树", title: "从前序与中序遍历序列构造二叉树图解", level: "中等", topic: "二叉树",
  h1: "前序 + 中序建树，前序定根，中序分左右",
  lede: "前序遍历的第一个数一定是根。在中序遍历里找到这个根，它左边的都属于左子树，右边的都属于右子树，于是也知道了左子树有几个节点，前序里对应的两段也就切出来了。两边递归。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "tree.jpg": [F.tree([3, 9, 20, null, null, 15, 7])],
  },
  hints: [
    { t: "谁是根", body: ["前序遍历是 根 → 左 → 右，所以 <code>preorder[0]</code> 是根。"] },
    { t: "怎么分左右", body: ["在中序遍历（左 → 根 → 右）里找到根的位置 <code>k</code>。", "<code>inorder[:k]</code> 是左子树，<code>inorder[k+1:]</code> 是右子树。左子树有 <code>k</code> 个节点。", "前序里根后面紧跟着的 <code>k</code> 个数是左子树，剩下的是右子树。"] },
    { t: "怎么写得快", body: ["用哈希表记下每个值在中序里的下标，找根变成 O(1)。", "递归时传区间的下标，不要切片复制数组。"] },
  ],
  codes: [{ t: "标准解法：递归 + 哈希表定位", code: `
class Solution:
    def buildTree(self, preorder: List[int], inorder: List[int]) -> Optional[TreeNode]:
        idx = {v: i for i, v in enumerate(inorder)}    # 值 -> 中序下标 #@init

        def build(pl, pr, il, ir):          # 前序 [pl, pr)，中序 [il, ir)
            if pl == pr:
                return None
            root = TreeNode(preorder[pl])   # 前序第一个是根 #@root
            k = idx[root.val]               #@root
            left_size = k - il              # 中序里根左边的都是左子树 #@root
            root.left = build(pl + 1, pl + 1 + left_size, il, k)    #@sub
            root.right = build(pl + 1 + left_size, pr, k + 1, ir)   #@sub
            return root

        return build(0, len(preorder), 0, len(inorder))     #@init,done
` }, { t: "简洁写法：切片递归", kind: "elegant", note: "切片和 index 让每层多了 O(n) 的开销，最坏 O(n²)，但写起来最直观。", code: `
class Solution:
    def buildTree(self, preorder: List[int], inorder: List[int]) -> Optional[TreeNode]:
        if not preorder:
            return None
        k = inorder.index(preorder[0])
        return TreeNode(preorder[0],
                        self.buildTree(preorder[1:k + 1], inorder[:k]),
                        self.buildTree(preorder[k + 1:], inorder[k + 1:]))
` }],
  pytest: `
s = Solution()
assert toT(s.buildTree([3,9,20,15,7], [9,3,15,20,7])) == [3,9,20,None,None,15,7]
assert toT(s.buildTree([-1], [-1])) == [-1]
assert toT(s.buildTree([1,2,4,5,3,6], [4,2,5,1,6,3])) == [1,2,3,4,5,6]
assert toT(s.buildTree([1,2,3], [3,2,1])) == [1,2,None,3]
`,
  sig: { fn: "buildTree", params: ["int[]", "int[]"], ret: "TreeNode" },
  call: (a) => [a.pre, a.ino],
  cases: [[[-1], [-1]], [[1, 2, 3], [3, 2, 1]], [[1, 2, 3], [1, 2, 3]], [[3000, -3000], [-3000, 3000]]],
  legend: [["a", "根"], ["e", "左子树的一段"], ["g", "右子树的一段"], ["c", "已经建好的节点"]],
  presets: [
    { label: "示例 1", args: { pre: [3, 9, 20, 15, 7], ino: [9, 3, 15, 20, 7] }, note: "preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]", expect: [3, 9, 20, null, null, 15, 7] },
    { label: "满一点的树", args: { pre: [1, 2, 4, 5, 3, 6], ino: [4, 2, 5, 1, 6, 3] }, note: "preorder = [1,2,4,5,3,6], inorder = [4,2,5,1,6,3]", expect: [1, 2, 3, 4, 5, 6] },
  ],
  build(a, snap) {
    const P = a.pre, I = a.ino, idx = {}, N = {}, built = new Set();
    I.forEach((v, i) => (idx[v] = i));
    const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
    const view = (pl, pr, il, ir, k, ls, nid, opts = {}) => {
      const pc = (i) => (i === pl && k >= 0 ? "a" : k >= 0 && i > pl && i <= pl + ls ? "e" : k >= 0 && i > pl + ls && i < pr ? "g" : built.has(P[i]) ? "c" : "");
      const ic = (i) => (i === k ? "a" : k >= 0 && i >= il && i < k ? "e" : k >= 0 && i > k && i < ir ? "g" : built.has(I[i]) ? "c" : "");
      const cls = {};
      for (const id in N) cls[id] = +id === nid ? "a" : "c";
      const tree = Object.keys(N).length
        ? {
            t: "tree",
            label: "正在构造的二叉树（带 L/R 方向）",
            nodes: snapNodes(),
            root: 0,
            cls,
            directed: true,
            lrLabels: true,
            ptrs: nid >= 0 ? { root: nid } : {},
            ...(opts.prevNodes ? { prevNodes: opts.prevNodes } : {}),
            ...(opts.animEdges ? { animEdges: opts.animEdges } : {}),
            ...(opts.onEdges ? { onEdges: opts.onEdges } : {}),
          }
        : { t: "note", label: "树", html: "还没有节点" };
      return [
        { t: "array", label: "preorder", items: P.map((v, i) => ({ v, cls: pc(i) })), ptrs: k >= 0 ? { pl } : {} },
        { t: "array", label: "inorder", items: I.map((v, i) => ({ v, cls: ic(i) })), ptrs: k >= 0 ? { k } : {} },
        tree,
      ];
    };
    let prevRoot, prevLs, prevCount = 0;
    snap("开始", "先用哈希表记下每个值在中序里的下标。前序的第一个数是整棵树的根。", view(-1, -1, -1, -1, -1, 0, -1), {
      at: "init",
      facts: [["已建节点", 0]],
    });
    const build = (pl, pr, il, ir, id, par, side) => {
      if (pl === pr) return;
      const v = P[pl], k = idx[v], ls = k - il;
      const prevSnap = snapNodes();
      N[id] = { v, l: null, r: null };
      if (par !== null) N[par][side] = id;
      built.add(v);
      const curCount = built.size;
      const facts = [
        ["当前根", v, prevRoot],
        ["中序下标 k", k],
        ["left_size", ls, prevLs],
        ["已建节点", curCount, prevCount],
      ];
      prevRoot = v;
      prevLs = ls;
      prevCount = curCount;
      snap(
        `根 ${v}`,
        `这一段前序的第一个是 <b>${v}</b>，它是${par === null ? "整棵树的根" : ` ${N[par].v} 的${side === "l" ? "左" : "右"}孩子`}。在中序里它在下标 ${k}，左边 ${ls} 个数是左子树${ls ? `（${I.slice(il, k).join(",")}）` : "（空）"}，右边 ${ir - k - 1} 个是右子树${ir - k - 1 ? `（${I.slice(k + 1, ir).join(",")}）` : "（空）"}。`,
        view(pl, pr, il, ir, k, ls, id, {
          prevNodes: prevSnap,
          ...(par !== null ? { animEdges: [[par, id]], onEdges: [[par, id]] } : {}),
        }),
        { at: ["root", "sub"], facts },
      );
      build(pl + 1, pl + 1 + ls, il, k, 2 * id + 1, id, "l");
      build(pl + 1 + ls, pr, k + 1, ir, 2 * id + 2, id, "r");
    };
    build(0, P.length, 0, I.length, 0, null, null);
    const out = [], q = [0];
    while (q.length) { const id = q.shift(); if (id === null || !N[id]) { out.push(null); continue; } out.push(N[id].v); q.push(N[id].l, N[id].r); }
    while (out.length && out[out.length - 1] === null) out.pop();
    snap("完成", `树建好了，按层序写出来是 [${out.map((v) => (v === null ? "null" : v)).join(",")}]。`, view(-1, -1, -1, -1, -1, 0, -1), {
      at: "done",
      kind: "ok",
      ans: out,
      facts: [["已建节点", built.size]],
    });
  },
  points: [
    { t: "左子树大小是关键", body: "left_size = k − il。前序里左子树的范围是 [pl+1, pl+1+left_size)，算错一位整棵树就错了。" },
    { t: "值不重复", body: "题目保证值互不相同，哈希表定位才是唯一的。" },
    { t: "复杂度", body: "哈希表写法每个节点 O(1)，总共 O(n)；递归深度是树高。" },
  ],
};
