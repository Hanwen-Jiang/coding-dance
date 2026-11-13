module.exports = {
  id: 114, name: "二叉树展开为链表", title: "二叉树展开为链表图解", level: "中等", topic: "二叉树",
  h1: "二叉树展开为链表，把左子树插到右边",
  lede: "展开后的顺序是前序遍历。对当前节点：如果有左子树，就把原来的右子树接到左子树最右边的节点后面，再把整个左子树挪到右边。然后沿右指针往下走，重复这个过程。",
  hints: [
    { t: "目标顺序", body: ["展开后的链表按前序（根 → 左 → 右）排列，全部用 <code>right</code> 指针串起来，<code>left</code> 都是空。"] },
    { t: "一个节点怎么处理", body: ["节点 <code>cur</code> 有左子树时：左子树里前序最后一个节点，就是左子树最右边的节点 <code>pre</code>。", "原来的右子树应该接在 <code>pre</code> 后面：<code>pre.right = cur.right</code>。然后 <code>cur.right = cur.left</code>，<code>cur.left = None</code>。"] },
    { t: "往下走", body: ["处理完 <code>cur</code> 后走到 <code>cur.right</code>，继续同样的处理，直到走到空。整个过程只用 O(1) 额外空间。"] },
  ],
  codes: [{ t: "标准解法：原地挪左子树", code: `
class Solution:
    def flatten(self, root: Optional[TreeNode]) -> None:
        cur = root
        while cur:
            if cur.left:
                pre = cur.left
                while pre.right:            # 左子树最右边的节点
                    pre = pre.right
                pre.right = cur.right       # 原来的右子树接到它后面
                cur.right = cur.left        # 左子树挪到右边
                cur.left = None
            cur = cur.right
` }, { t: "简洁写法：反向前序", kind: "elegant", note: "按 右 → 左 → 根 的顺序访问，正好是前序倒过来，也就是从链表尾往头。每个节点接上一个访问的节点就行。", code: `
class Solution:
    def flatten(self, root: Optional[TreeNode]) -> None:
        prev = None
        def dfs(node):
            nonlocal prev
            if node:
                dfs(node.right)
                dfs(node.left)
                node.right, node.left, prev = prev, None, node
        dfs(root)
` }],
  pytest: `
s = Solution()
def chain(r):
    out = []
    while r:
        assert r.left is None
        out.append(r.val); r = r.right
    return out
r = T([1,2,5,3,4,None,6]); s.flatten(r); assert chain(r) == [1,2,3,4,5,6]
r = T([]); s.flatten(r); assert r is None
r = T([0]); s.flatten(r); assert chain(r) == [0]
r = T([1,2,3,4,5,6,7]); s.flatten(r); assert chain(r) == [1,2,4,5,3,6,7]
`,
  legend: [["a", "当前节点 cur"], ["b", "左子树最右的 pre"], ["c", "已经展开好的部分"]],
  presets: [
    { label: "示例 1", args: { t: [1, 2, 5, 3, 4, null, 6] }, note: "root = [1,2,5,3,4,null,6]", expect: [1, 2, 3, 4, 5, 6] },
    { label: "满二叉树", args: { t: [1, 2, 3, 4, 5, 6, 7] }, note: "root = [1,2,3,4,5,6,7]", expect: [1, 2, 4, 5, 3, 6, 7] },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const done = [];
    const view = (cur, pre) => { const cls = {}; for (const id in N) cls[id] = +id === cur ? "a" : +id === pre ? "b" : done.includes(+id) ? "c" : ""; return [{ t: "tree", nodes: N, root: 0, cls }]; };
    snap("开始", "从根节点开始，沿着右指针一路往下处理。", view(-1, -1));
    let cur = 0;
    while (cur !== null) {
      const nd = N[cur];
      if (nd.l !== null) {
        let pre = nd.l; while (N[pre].r !== null) pre = N[pre].r;
        snap("找 pre", `${nd.v} 有左子树。左子树最右边的节点是 <b>${N[pre].v}</b>，它是左子树前序遍历的最后一个。`, view(cur, pre));
        N[pre].r = nd.r; nd.r = nd.l; nd.l = null;
        snap("挪过去", `把 ${nd.v} 原来的右子树接到 ${N[pre].v} 后面，再把左子树整个挪到 ${nd.v} 的右边。`, view(cur, pre));
      } else snap("没有左子树", `${nd.v} 没有左子树，不用动。`, view(cur, -1));
      done.push(cur); cur = nd.r;
    }
    const out = []; let p = 0; while (p !== null) { out.push(N[p].v); p = N[p].r; }
    snap("完成", `展开成了一条只用右指针的链：${out.join(" → ")}，正是前序遍历的顺序。`, view(-1, -1), { kind: "ok", ans: out });
  },
  points: [
    { t: "先接右子树再挪左子树", body: "顺序反了的话，原来的右子树会丢掉。" },
    { t: "left 要置空", body: "题目要求左指针都是 null，挪完后记得 <code>cur.left = None</code>。" },
    { t: "复杂度", body: "每个节点最多被当成 pre 走过一次，时间 O(n)，空间 O(1)。" },
  ],
};
