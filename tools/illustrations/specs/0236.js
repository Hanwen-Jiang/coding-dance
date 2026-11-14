module.exports = {
  id: 236, name: "二叉树的最近公共祖先", title: "二叉树的最近公共祖先图解", level: "中等", topic: "二叉树",
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
  demoTitle: "递归演示",
  legend: [["e", "在调用栈上"], ["a", "当前节点"], ["b", "p 或 q"], ["c", "已经返回（下面标的是交上去的节点）"], ["k", "答案"]],
  presets: [
    { label: "示例 1", args: { t: [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], p: 5, q: 1 }, note: "root = [3,5,1,6,2,0,8,null,null,7,4], p = 5, q = 1", expect: 3 },
    { label: "示例 2", args: { t: [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], p: 5, q: 4 }, note: "同一棵树，p = 5, q = 4（q 在 p 下面）", expect: 5 },
    { label: "都在左子树", args: { t: [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], p: 7, q: 6 }, note: "同一棵树，p = 7, q = 6", expect: 5 },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const stack = [], badges = {}, done = new Set();
    const isPQ = (id) => N[id].v === a.p || N[id].v === a.q;
    const view = (cur, ans) => {
      const cls = {};
      for (const id in N) cls[id] = +id === ans ? "k" : +id === cur ? "a" : isPQ(+id) ? "b" : done.has(+id) ? "c" : stack.includes(+id) ? "e" : "";
      return [{ t: "tree", nodes: N, root: 0, cls, on: stack.slice(), badges: { ...badges } }];
    };
    const f = () => ({ facts: [["p", a.p], ["q", a.q]] });
    snap("开始", `找 ${a.p} 和 ${a.q} 的最近公共祖先。每个节点只问左右子树一句话：你们那边找到 p 或 q 了吗？`, view(-1), f());
    const rec = (id) => {
      if (id === null || !N[id]) return null;
      stack.push(id);
      if (isPQ(id)) {
        done.add(id); badges[id] = "交 " + N[id].v; stack.pop();
        snap("碰到目标", `${N[id].v} 就是要找的节点，不用再往下找，直接把自己交上去。`, view(id), f());
        return id;
      }
      snap("进入", `进入 ${N[id].v}，先问左子树，再问右子树。`, view(id), f());
      const l = rec(N[id].l), r = rec(N[id].r);
      const ret = l !== null && r !== null ? id : l !== null ? l : r;
      badges[id] = ret === null ? "空" : "交 " + N[ret].v; done.add(id); stack.pop();
      const msg = l !== null && r !== null ? `左边交上来 ${N[l].v}，右边交上来 ${N[r].v}，p、q 分在两边，<b>${N[id].v}</b> 就是最近公共祖先，把自己交上去。`
        : ret !== null ? `只有一边找到了 ${N[ret].v}，原样往上交。` : "左右两边都没找到，返回空。";
      snap("返回", `${N[id].v}：${msg}`, view(id), f());
      return ret;
    };
    const res = rec(0);
    snap("完成", `根节点最后交上来的是 <b>${N[res].v}</b>，它就是 ${a.p} 和 ${a.q} 的最近公共祖先。`, view(-1, res), { kind: "ok", ans: N[res].v, ...f() });
  },
  points: [
    { t: "比较的是节点不是值", body: "用 <code>is</code> 比较节点本身。题目保证值不重复，但用节点比较更稳。" },
    { t: "返回值有两种含义", body: "可能是找到的 p 或 q，也可能是已经确定的答案。上层不用区分，原样往上交就行。" },
    { t: "复杂度", body: "每个节点最多访问一次，时间 O(n)；递归深度是树高，最坏 O(n)。" },
  ],
};
