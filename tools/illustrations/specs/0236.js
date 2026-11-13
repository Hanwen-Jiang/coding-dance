// 图解页面是手写的（illustrations/0236.二叉树的最近公共祖先.html），这里只提供提示和代码，build 只跑测试、不生成页面。
module.exports = {
  id: 236, name: "二叉树的最近公共祖先", title: "二叉树的最近公共祖先图解", level: "中等", topic: "二叉树", handwritten: true,
  h1: "二叉树的最近公共祖先，让答案自己往上冒",
  lede: "每个节点只问左右子树一句话：你们那边找到 p 或 q 了吗？左右都说找到了，自己就是答案。",
  hints: [
    { t: "先定好递归函数返回什么", body: ["让函数 <code>f(node)</code> 回答：在以 <code>node</code> 为根的这棵子树里，有没有找到 p 或 q？", "找到了就把找到的节点交上来，什么都没找到就返回空。"] },
    { t: "拿到左右两边的回答后怎么办", body: ["<strong>左右都不为空</strong>：p 和 q 分别在两侧，当前节点就是最近公共祖先，返回自己。", "<strong>只有一边不为空</strong>：把那一边的结果原样往上交。它可能是 p 或 q，也可能是下面已经找到的答案。", "<strong>都为空</strong>：这棵子树里什么都没有，返回空。"] },
    { t: "碰到 p 为什么可以直接返回", body: ["走到 p 时，不用再往下找 q。如果 q 在 p 下面，答案就是 p 自己；如果 q 不在 p 下面，别的分支会找到 q，在上面汇合。", "这一步依赖题目保证 p、q 都在树里。"] },
  ],
  codes: [{ t: "标准解法：后序递归", code: `
class Solution:
    def lowestCommonAncestor(self, root, p, q):
        if root is None or root is p or root is q:
            return root                 # 空，或者就是要找的节点
        left = self.lowestCommonAncestor(root.left, p, q)
        right = self.lowestCommonAncestor(root.right, p, q)
        if left and right:
            return root                 # p、q 分在两边
        return left or right            # 哪边有就交哪边
` }, { t: "简洁写法：四行递归", kind: "elegant", code: `
class Solution:
    def lowestCommonAncestor(self, root, p, q):
        if root in (None, p, q):
            return root
        l, r = (self.lowestCommonAncestor(c, p, q) for c in (root.left, root.right))
        return root if l and r else l or r
` }, { t: "不用递归：记录父节点", note: "先遍历一遍记下每个节点的父节点，再从 p 一路往上把祖先都放进集合，最后从 q 往上走，第一个在集合里的就是答案。", code: `
class Solution:
    def lowestCommonAncestor(self, root, p, q):
        parent = {root: None}
        stack = [root]
        while p not in parent or q not in parent:
            node = stack.pop()
            for child in (node.left, node.right):
                if child:
                    parent[child] = node
                    stack.append(child)
        ancestors = set()
        while p:                        # p 和它所有的祖先
            ancestors.add(p)
            p = parent[p]
        while q not in ancestors:       # q 往上走，第一个碰到的就是答案
            q = parent[q]
        return q
` }],
  pytest: `
def find(r, v):
    if not r: return None
    if r.val == v: return r
    return find(r.left, v) or find(r.right, v)
s = Solution()
r = T([3,5,1,6,2,0,8,None,None,7,4])
assert s.lowestCommonAncestor(r, find(r,5), find(r,1)).val == 3
assert s.lowestCommonAncestor(r, find(r,5), find(r,4)).val == 5
assert s.lowestCommonAncestor(r, find(r,7), find(r,8)).val == 3
assert s.lowestCommonAncestor(r, find(r,6), find(r,4)).val == 5
r = T([1,2])
assert s.lowestCommonAncestor(r, find(r,1), find(r,2)).val == 1
`,
  points: [
    { t: "比较的是节点不是值", body: "用 <code>is</code> 比较节点本身。题目保证值不重复，但用节点比较更稳。" },
    { t: "返回值有两种含义", body: "可能是找到的 p 或 q，也可能是已经确定的答案。上层不用区分，原样往上交就行。" },
    { t: "复杂度", body: "每个节点最多访问一次，时间 O(n)；递归深度是树高，最坏 O(n)。" },
  ],
};
