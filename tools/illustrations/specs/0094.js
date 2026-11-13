module.exports = {
  id: 94, name: "二叉树的中序遍历", title: "二叉树的中序遍历图解", level: "简单", topic: "二叉树",
  h1: "二叉树的中序遍历，先左、再自己、最后右",
  lede: "中序遍历的规则对每个节点都一样：先把左子树整个走完，再记下自己，最后走右子树。递归写法只有三行，迭代写法是用一个栈把递归的过程手动模拟出来。",
  hints: [
    { t: "三种遍历只差一行", body: ["前序：自己 → 左 → 右。中序：左 → 自己 → 右。后序：左 → 右 → 自己。", "区别只在「记下自己」这一行放在两次递归的前面、中间还是后面。"] },
    { t: "递归怎么写", body: ["函数 <code>dfs(node)</code>：节点为空就返回；否则先 <code>dfs(node.left)</code>，再把 <code>node.val</code> 放进结果，再 <code>dfs(node.right)</code>。"] },
    { t: "不用递归怎么写", body: ["一路往左走，把经过的节点都压进栈，直到左边没有节点。", "弹出栈顶，记下它，然后转向它的右孩子，重复上面的过程。"] },
  ],
  codes: [{ t: "标准解法：递归", code: `
class Solution:
    def inorderTraversal(self, root: Optional[TreeNode]) -> List[int]:
        res = []
        def dfs(node):
            if not node:
                return
            dfs(node.left)              # 左
            res.append(node.val)        # 自己
            dfs(node.right)             # 右
        dfs(root)
        return res
` }, { t: "迭代写法：用栈模拟", code: `
class Solution:
    def inorderTraversal(self, root: Optional[TreeNode]) -> List[int]:
        res, stack, cur = [], [], root
        while cur or stack:
            while cur:                  # 一路向左，沿途入栈
                stack.append(cur)
                cur = cur.left
            cur = stack.pop()
            res.append(cur.val)
            cur = cur.right             # 转向右子树
        return res
` }, { t: "简洁写法：一行递归", kind: "elegant", note: "左子树的结果 + 自己 + 右子树的结果。列表拼接有额外开销，但最贴近定义。", code: `
class Solution:
    def inorderTraversal(self, root: Optional[TreeNode]) -> List[int]:
        if not root:
            return []
        return self.inorderTraversal(root.left) + [root.val] + self.inorderTraversal(root.right)
` }],
  pytest: `
s = Solution()
assert s.inorderTraversal(T([1,None,2,3])) == [1,3,2]
assert s.inorderTraversal(T([])) == []
assert s.inorderTraversal(T([1])) == [1]
assert s.inorderTraversal(T([4,2,6,1,3,5,7])) == [1,2,3,4,5,6,7]
`,
  legend: [["e", "在调用栈上，还没记"], ["a", "当前节点"], ["c", "已经记进结果"]],
  presets: [
    { label: "示例 1", args: { t: [1, null, 2, null, null, 3] }, note: "root = [1,null,2,3]", expect: [1, 3, 2] },
    { label: "满二叉树", args: { t: [4, 2, 6, 1, 3, 5, 7] }, note: "root = [4,2,6,1,3,5,7]", expect: [1, 2, 3, 4, 5, 6, 7] },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const res = [], st = {}, stack = [], order = {};
    const view = (cur) => { const cls = {}; for (const id in N) cls[id] = +id === cur ? "a" : st[id] === "done" ? "c" : stack.includes(+id) ? "e" : ""; return [{ t: "tree", nodes: N, root: 0, cls, on: stack.slice(), badges: order }, { t: "chips", label: "结果", items: res.slice(), empty: "还没有" }]; };
    snap("开始", "从根节点开始。每个节点都按「左 → 自己 → 右」的顺序处理。", view(-1));
    const dfs = (id) => {
      const nd = N[id]; stack.push(id);
      snap("进入", `进入 ${nd.v}。` + (nd.l !== null ? "先去左子树。" : "它没有左孩子，左边算走完了。"), view(id));
      if (nd.l !== null) dfs(nd.l);
      res.push(nd.v); st[id] = "done"; order[id] = "第 " + res.length;
      snap("记下自己", `${nd.v} 的左子树走完了，把 <b>${nd.v}</b> 记进结果。` + (nd.r !== null ? "接着去右子树。" : "它没有右孩子，返回上一层。"), view(id));
      if (nd.r !== null) dfs(nd.r);
      stack.pop();
    };
    dfs(0);
    snap("完成", `中序遍历的结果是 [${res.join(", ")}]。`, view(-1), { kind: "ok", ans: res });
  },
  points: [
    { t: "二叉搜索树的中序是有序的", body: "对二叉搜索树做中序遍历，得到的正好是从小到大的序列。很多 BST 的题都靠这一点。" },
    { t: "迭代写法的循环条件", body: "<code>while cur or stack</code>：栈空了但 cur 还指着右子树时，遍历还没结束。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)。空间是树的高度，最坏 O(n)。" },
  ],
};
