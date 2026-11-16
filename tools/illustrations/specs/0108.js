const F = require("../fig");

module.exports = {
  id: 108, name: "将有序数组转换为二叉搜索树", title: "有序数组转二叉搜索树图解", level: "简单", topic: "二叉树",
  h1: "将有序数组转换为二叉搜索树，每次拿中间的数当根",
  lede: "要让树平衡，左右两边的节点数就要尽量一样多。数组已经有序，取中间的数当根，它左边的数都比它小，放进左子树；右边的数都比它大，放进右子树。左右两段再用同样的办法各自建树。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "btree1.jpg": [F.tree([0, -3, 9, -10, null, 5])],
    "btree2.jpg": [F.tree([0, -10, 5, null, -3, null, 9])],
    "btree.jpg": [F.row([F.tree([3, 1]), F.tree([1, null, 3])], { sep: "或" })],
  },
  hints: [
    { t: "根节点选谁", body: ["二叉搜索树要求左子树都比根小，右子树都比根大。有序数组里任何一个数都能当根。", "但要平衡，就得选<strong>中间</strong>的数，这样两边的数量最多差 1。"] },
    { t: "剩下的怎么办", body: ["中间数左边的那一段，是同样的问题：把一个有序数组变成平衡的二叉搜索树。右边那一段也是。", "所以递归：<code>build(lo, hi)</code> 用下标表示当前这一段。"] },
    { t: "递归的终点", body: ["<code>lo &gt; hi</code> 时这一段是空的，返回空节点。"] },
  ],
  codes: [{ t: "标准解法：递归取中点", code: `
class Solution:
    def sortedArrayToBST(self, nums: List[int]) -> Optional[TreeNode]:
        def build(lo, hi):
            if lo > hi:
                return None
            mid = (lo + hi) // 2            #@node
            node = TreeNode(nums[mid])      #@node
            node.left = build(lo, mid - 1)  #@sub
            node.right = build(mid + 1, hi) #@sub
            return node
        return build(0, len(nums) - 1)      #@init,done
` }, { t: "简洁写法：切片递归", kind: "elegant", note: "切片会复制数组，多了 O(n log n) 的开销，但代码最短。", code: `
class Solution:
    def sortedArrayToBST(self, nums: List[int]) -> Optional[TreeNode]:
        if not nums:
            return None
        m = (len(nums) - 1) // 2
        return TreeNode(nums[m], self.sortedArrayToBST(nums[:m]), self.sortedArrayToBST(nums[m + 1:]))
` }],
  pytest: `
def ok(root, lo=float("-inf"), hi=float("inf")):
    # 返回高度；不是平衡的 BST 就抛异常
    if not root: return 0
    assert lo < root.val < hi
    l, r = ok(root.left, lo, root.val), ok(root.right, root.val, hi)
    assert abs(l - r) <= 1
    return max(l, r) + 1
def inorder(r): return inorder(r.left) + [r.val] + inorder(r.right) if r else []
s = Solution()
for a in [[-10,-3,0,5,9], [1,3], [1], list(range(20))]:
    t = s.sortedArrayToBST(a); ok(t); assert inorder(t) == a
`,
  sig: { fn: "sortedArrayToBST", params: ["int[]"], ret: "TreeNode" },
  call: (a) => [a.nums],
  cases: [[[1, 3]], [[1]], [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], [[-10, -3, 0, 5, 9]]],
  legend: [["e", "当前这一段"], ["a", "选中的中点"], ["d", "已经建成节点"]],
  presets: [
    { label: "示例 1", args: { nums: [-10, -3, 0, 5, 9] }, note: "nums = [-10,-3,0,5,9]", expect: [0, -10, -3, 5, 9] },
    { label: "七个数", args: { nums: [1, 2, 3, 4, 5, 6, 7] }, note: "nums = [1,2,3,4,5,6,7]", expect: [4, 2, 1, 3, 6, 5, 7] },
  ],
  build(a, snap) {
    const nums = a.nums, N = {}, made = new Set(), pre = []; let root = null;
    const view = (lo, hi, mid) => {
      const cls = {}; for (const id in N) cls[id] = +id === mid ? "a" : "";
      const tree = root === null ? { t: "chips", label: "树", items: [], empty: "还没有节点" } : { t: "tree", label: "树", nodes: JSON.parse(JSON.stringify(N)), root, cls };
      return [{ t: "array", label: "nums", items: nums.map((v, i) => ({ v, cls: i === mid ? "a" : made.has(i) ? "d" : i >= lo && i <= hi ? "e" : "" })), ptrs: lo <= hi ? { lo, hi, mid } : {} }, tree];
    };
    snap("开始", "数组是有序的。先在整个数组里取中间的数当根。", view(0, nums.length - 1), { at: "init" });
    const build = (lo, hi, parent, side) => {
      if (lo > hi) return null;
      const mid = (lo + hi) >> 1;
      N[mid] = { v: nums[mid], l: null, r: null }; made.add(mid); pre.push(nums[mid]);
      if (parent === null) root = mid; else N[parent][side] = mid;
      snap("取中点建节点", `在下标 [${lo}, ${hi}] 这一段里，中点是下标 ${mid}，值 <b>${nums[mid]}</b>。` + (parent === null ? "它是整棵树的根。" : `它成为 ${nums[parent]} 的${side === "l" ? "左" : "右"}孩子。`) + (lo === hi ? "这一段只有它一个，是叶子。" : `它左边的 [${lo}, ${mid - 1}] 去建左子树，右边的 [${mid + 1}, ${hi}] 去建右子树。`), view(lo, hi, mid), { at: lo === hi ? "node" : ["node", "sub"] });
      build(lo, mid - 1, mid, "l"); build(mid + 1, hi, mid, "r");
      return mid;
    };
    build(0, nums.length - 1, null, null);
    snap("完成", "每个数都成了一个节点。任何节点的左右子树高度最多差 1，中序遍历出来就是原数组。", view(0, -1), { at: "done", kind: "ok", ans: pre });
  },
  points: [
    { t: "答案不唯一", body: "偶数个数时，中间有两个数可以选。取 <code>(lo + hi) // 2</code> 是偏左的那个，偏右也对。" },
    { t: "传下标，不要切片", body: "写 <code>nums[:mid]</code> 每次都会复制数组。传 <code>lo</code>、<code>hi</code> 两个下标更省。" },
    { t: "复杂度", body: "每个数建一个节点，时间 O(n)。递归深度 O(log n)。" },
  ],
};
