module.exports = {
  id: 230, name: "二叉搜索树中第 K 小的元素", title: "二叉搜索树中第 K 小的元素图解", level: "中等", topic: "二叉树",
  h1: "BST 第 K 小，中序遍历数到第 k 个",
  lede: "二叉搜索树的中序遍历（左 → 根 → 右）正好是从小到大的顺序。所以做中序遍历，数到第 k 个就停下，不用把整棵树都走完。",
  hints: [
    { t: "BST 的中序是有序的", body: ["对 BST 做中序遍历，访问到的值是严格递增的。", "第 k 小就是中序遍历访问到的第 k 个节点。"] },
    { t: "数到第 k 个就停", body: ["每访问一个节点，<code>k -= 1</code>。<code>k</code> 变成 0 时，当前节点就是答案。", "用迭代写法（栈）可以直接 return，不用设全局变量。"] },
    { t: "进阶：频繁修改怎么办", body: ["如果树经常插入删除、又要频繁查第 k 小，可以在每个节点记下子树大小，查询变成 O(树高)。"] },
  ],
  codes: [{ t: "标准解法：迭代中序遍历", code: `
class Solution:
    def kthSmallest(self, root: Optional[TreeNode], k: int) -> int:
        stack, cur = [], root               #@init
        while True:
            while cur:                      # 一路向左 #@left
                stack.append(cur)           #@left
                cur = cur.left              #@left
            cur = stack.pop()               #@pop
            k -= 1                          #@pop
            if k == 0:                      # 中序遍历的第 k 个 #@found
                return cur.val              #@found
            cur = cur.right                 #@right
` }, { t: "简洁写法：生成器 + islice", kind: "elegant", note: "生成器是惰性的，取到第 k 个就不会再往下遍历。", code: `
from itertools import islice

class Solution:
    def kthSmallest(self, root: Optional[TreeNode], k: int) -> int:
        def inorder(node):
            if node:
                yield from inorder(node.left)
                yield node.val
                yield from inorder(node.right)
        return next(islice(inorder(root), k - 1, None))
` }],
  pytest: `
s = Solution()
assert s.kthSmallest(T([3,1,4,None,2]), 1) == 1
assert s.kthSmallest(T([5,3,6,2,4,None,None,1]), 3) == 3
assert s.kthSmallest(T([5,3,6,2,4,None,None,1]), 6) == 6
assert s.kthSmallest(T([1]), 1) == 1
`,
  sig: { fn: "kthSmallest", params: ["TreeNode", "int"], ret: "int" },
  call: (a, H) => [H.toLc(a.t), a.k],
  cases: [[[1], 1], [[5, 3, 6, 2, 4, null, null, 1], 6], [[2, 1, 3], 3], [[1, null, 2, null, 3], 2]],
  legend: [["e", "在栈里"], ["a", "当前节点"], ["c", "已经数过"], ["k", "答案"]],
  presets: [
    { label: "示例 1", args: { t: [3, 1, 4, null, 2], k: 1 }, note: "root = [3,1,4,null,2], k = 1", expect: 1 },
    { label: "示例 2", args: { t: [5, 3, 6, 2, 4, null, null, 1], k: 3 }, note: "root = [5,3,6,2,4,null,null,1], k = 3", expect: 3 },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const stack = [], done = [], badges = {}; let k = a.k, cur = 0;
    const view = (now, ans) => { const cls = {}; for (const id in N) cls[id] = +id === ans ? "k" : +id === now ? "a" : done.includes(+id) ? "c" : stack.includes(+id) ? "e" : ""; return [{ t: "tree", nodes: N, root: 0, cls, on: stack.slice(), badges }, { t: "chips", label: "栈（右边是栈顶）", items: stack.map((i) => N[i].v), empty: "空" }]; };
    snap("开始", `中序遍历是从小到大的顺序，数到第 ${k} 个就是答案。`, view(-1), { at: "init", facts: [["还要数", k]] });
    while (true) {
      while (cur !== null && cur !== undefined && N[cur]) { stack.push(cur); snap("向左走", `把 ${N[cur].v} 压栈，继续往左走。`, view(cur), { at: "left", facts: [["还要数", k]] }); cur = N[cur].l; }
      cur = stack.pop(); k--; done.push(cur); badges[cur] = "第 " + done.length;
      if (k === 0) { snap("找到", `弹出 ${N[cur].v}，这是中序遍历的第 ${a.k} 个，答案是 <b>${N[cur].v}</b>。后面的节点不用再看了。`, view(-1, cur), { at: ["pop", "found"], kind: "ok", ans: N[cur].v, facts: [["还要数", 0]] }); return; }
      snap("数一个", `左边走到头了，弹出 ${N[cur].v}，它是第 ${done.length} 小的。还要再数 ${k} 个，转向它的右子树。`, view(cur), { at: ["pop", "right"], facts: [["还要数", k]] });
      cur = N[cur].r;
    }
  },
  points: [
    { t: "k 从 1 开始", body: "第 1 小是中序的第一个。先减再判断 0，或者先判断 1 再减，别弄错。" },
    { t: "提前停止", body: "递归写法要用一个外部变量记录答案，并在找到后不再继续。迭代写法直接 return 更干净。" },
    { t: "复杂度", body: "时间 O(H + k)，H 是树高。空间 O(H)。" },
  ],
};
