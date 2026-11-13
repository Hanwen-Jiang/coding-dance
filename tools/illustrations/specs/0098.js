module.exports = {
  id: 98, name: "验证二叉搜索树", title: "验证二叉搜索树图解", level: "中等", topic: "二叉树",
  h1: "验证二叉搜索树，每个节点都带着一个允许的范围",
  lede: "只比较节点和它的左右孩子是不够的：右子树里的所有节点都必须比根大，不只是右孩子。往下走的时候，把祖先给出的限制一路带下去，每个节点的值必须落在一个开区间里。",
  hints: [
    { t: "常见的错误做法", body: ["只检查 <code>左孩子 &lt; 自己 &lt; 右孩子</code> 是错的。", "比如根是 5，右孩子是 6，6 的左孩子是 3。每个节点和自己的孩子比都没问题，但 3 在 5 的右子树里却比 5 小。"] },
    { t: "带着范围往下走", body: ["给每个节点一个允许的范围 <code>(lo, hi)</code>，根节点是 <code>(−∞, +∞)</code>。", "往左走：上界收紧成当前节点的值。往右走：下界收紧成当前节点的值。"] },
    { t: "另一种做法", body: ["二叉搜索树的中序遍历是严格递增的。", "做一次中序遍历，检查每个值是否都大于前一个值。"] },
  ],
  codes: [{ t: "标准解法：递归传上下界", code: `
class Solution:
    def isValidBST(self, root: Optional[TreeNode]) -> bool:
        def check(node, lo, hi):
            if not node:
                return True
            if not (lo < node.val < hi):
                return False
            return check(node.left, lo, node.val) and check(node.right, node.val, hi)
        return check(root, float("-inf"), float("inf"))
` }, { t: "另一种写法：中序遍历要严格递增", code: `
class Solution:
    def isValidBST(self, root: Optional[TreeNode]) -> bool:
        prev = float("-inf")
        def inorder(node):
            nonlocal prev
            if not node:
                return True
            if not inorder(node.left):
                return False
            if node.val <= prev:        # 必须比前一个大
                return False
            prev = node.val
            return inorder(node.right)
        return inorder(root)
` }],
  pytest: `
s = Solution()
assert s.isValidBST(T([2,1,3])) is True
assert s.isValidBST(T([5,1,4,None,None,3,6])) is False
assert s.isValidBST(T([5,4,6,None,None,3,7])) is False
assert s.isValidBST(T([1,1])) is False
assert s.isValidBST(T([2147483647])) is True
`,
  legend: [["a", "当前节点"], ["c", "在允许的范围内"], ["w", "超出范围"]],
  presets: [
    { label: "示例 1", args: { t: [2, 1, 3] }, note: "root = [2,1,3]", expect: true },
    { label: "孩子都对，孙子不对", args: { t: [5, 4, 6, null, null, 3, 7] }, note: "root = [5,4,6,null,null,3,7]", expect: false },
    { label: "合法的大一点的树", args: { t: [8, 4, 12, 2, 6, 10, 14] }, note: "root = [8,4,12,2,6,10,14]", expect: true },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const st = {}, rng = {};
    const f = (x) => (x === -Infinity ? "−∞" : x === Infinity ? "+∞" : x);
    const view = (cur) => { const cls = {}; for (const id in N) cls[id] = +id === cur && !st[id] ? "a" : st[id] || ""; return [{ t: "tree", nodes: N, root: 0, cls, badges: rng }]; };
    snap("开始", "每个节点下方会标出它允许的范围。根节点没有限制。", view(-1));
    const check = (id, lo, hi, why) => {
      const nd = N[id]; rng[id] = `(${f(lo)}, ${f(hi)})`;
      const ok = lo < nd.v && nd.v < hi;
      st[id] = ok ? "c" : "w";
      snap(ok ? "在范围内" : "超出范围", `${nd.v}${why}，允许的范围是 (${f(lo)}, ${f(hi)})。` + (ok ? `${nd.v} 在范围内。` : `<b>${nd.v} 不在范围内</b>，这不是二叉搜索树。`), view(id), ok ? {} : { kind: "warn" });
      if (!ok) return false;
      if (nd.l !== null && !check(nd.l, lo, nd.v, ` 在 ${nd.v} 的左边，上界收紧成 ${nd.v}`)) return false;
      if (nd.r !== null && !check(nd.r, nd.v, hi, ` 在 ${nd.v} 的右边，下界收紧成 ${nd.v}`)) return false;
      return true;
    };
    const ans = check(0, -Infinity, Infinity, " 是根节点");
    snap("完成", ans ? "所有节点都在各自的范围内，是合法的二叉搜索树。" : "有节点超出了祖先给它的范围，返回 false。", view(-1), { kind: ans ? "ok" : "warn", ans });
  },
  points: [
    { t: "严格大于、严格小于", body: "二叉搜索树里不能有相等的值，所以范围是开区间，用 <code>&lt;</code> 而不是 <code>&lt;=</code>。" },
    { t: "初始范围用无穷", body: "节点值可以取到 32 位整数的最大最小值，所以上下界要用 <code>float('inf')</code>，不能用某个具体的大数。" },
    { t: "复杂度", body: "每个节点检查一次，时间 O(n)。" },
  ],
};
