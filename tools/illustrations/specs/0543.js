module.exports = {
  id: 543, name: "二叉树的直径", title: "二叉树的直径图解", level: "简单", topic: "二叉树",
  h1: "二叉树的直径，在每个节点上拐一次弯",
  lede: "任何一条路径都有一个最高的节点，路径从它的左边上来，在它这里拐弯，再从右边下去。所以以某个节点为最高点的最长路径，长度就是左子树的深度加右子树的深度。算深度的时候顺手把这个值记下来，取最大的。",
  hints: [
    { t: "直径不一定过根节点", body: ["最长的路径可能完全在某一棵子树里面，所以不能只看根节点。", "每个节点都要当一次「拐弯的地方」算一下。"] },
    { t: "在一个节点拐弯的最长路径", body: ["从这个节点往左最多能走「左子树的深度」条边，往右最多能走「右子树的深度」条边。", "所以经过它的最长路径有 <code>左深度 + 右深度</code> 条边。"] },
    { t: "一次遍历做两件事", body: ["递归函数返回的是<strong>深度</strong>（给上一层用）。", "在返回之前，用 <code>左深度 + 右深度</code> 更新全局的最大值（这才是答案）。"] },
  ],
  codes: [{ t: "标准解法：算深度时顺便更新直径", code: `
class Solution:
    def diameterOfBinaryTree(self, root: Optional[TreeNode]) -> int:
        best = 0                        #@init
        def depth(node):
            nonlocal best
            if not node:
                return 0
            l, r = depth(node.left), depth(node.right)  #@calc
            best = max(best, l + r)     # 在这个节点拐弯的最长路径 #@calc
            return max(l, r) + 1        # 返回给上一层的是深度 #@calc
        depth(root)                     #@init
        return best                     #@done
` }, { t: "简洁写法：返回二元组，不用全局变量", kind: "elegant", note: "递归同时返回「深度」和「子树里的最大直径」。", code: `
class Solution:
    def diameterOfBinaryTree(self, root: Optional[TreeNode]) -> int:
        def dfs(node):
            if not node:
                return 0, 0
            (ld, lb), (rd, rb) = dfs(node.left), dfs(node.right)
            return 1 + max(ld, rd), max(lb, rb, ld + rd)
        return dfs(root)[1]
` }],
  pytest: `
s = Solution()
assert s.diameterOfBinaryTree(T([1,2,3,4,5])) == 3
assert s.diameterOfBinaryTree(T([1,2])) == 1
assert s.diameterOfBinaryTree(T([1])) == 0
assert s.diameterOfBinaryTree(T([1,2,None,3,4,5,None,None,6])) == 4
`,
  sig: { fn: "diameterOfBinaryTree", params: ["TreeNode"], ret: "int" },
  call: (a, H) => [H.toLc(a.t)],
  cases: [[[1]], [[1, 2]], [[1, 2, null, 3, 4, 5, null, null, 6]]],
  legend: [["e", "在调用栈上"], ["a", "当前节点"], ["c", "已经算完"]],
  presets: [
    { label: "示例 1", args: { t: [1, 2, 3, 4, 5] }, note: "root = [1,2,3,4,5]", expect: 3 },
    { label: "直径不过根", args: { t: [1, 2, null, 3, 4, null, null, 5, null, null, 6] }, note: "root = [1,2,null,3,4,5,null,null,6]", expect: 4 },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const dep = {}, stack = []; let best = 0, bestAt = null;
    const view = (cur) => { const cls = {}; for (const id in N) cls[id] = +id === cur ? "a" : id in dep ? "c" : stack.includes(+id) ? "e" : ""; const b = {}; for (const id in dep) b[id] = "深度 " + dep[id]; return [{ t: "tree", nodes: N, root: 0, cls, on: stack.slice(), badges: b }]; };
    snap("开始", "对每个节点算出深度，同时用「左深度 + 右深度」更新最长路径。", view(-1), { at: "init", facts: [["最长路径", 0]] });
    const dfs = (id) => {
      const nd = N[id]; stack.push(id);
      const L = nd.l !== null ? dfs(nd.l) : 0, R = nd.r !== null ? dfs(nd.r) : 0;
      const through = L + R, up = through > best;
      if (up) { best = through; bestAt = id; }
      dep[id] = Math.max(L, R) + 1;
      snap(up ? "更新最长路径" : "算出深度", `${nd.v}：左深度 ${L}，右深度 ${R}。在它这里拐弯的路径有 ${L} + ${R} = <b>${through}</b> 条边` + (up ? "，是目前最长的。" : `，没有超过 ${best}。`) + `它向上返回深度 ${dep[id]}。`, view(id), { at: "calc", kind: up ? "ok" : "", facts: [["最长路径", best], ["这里拐弯", through]] });
      stack.pop();
      return dep[id];
    };
    dfs(0);
    snap("完成", `直径是 <b>${best}</b> 条边，最长的那条路径在 ${N[bestAt].v} 这里拐弯。`, view(-1), { at: "done", kind: "ok", ans: best, facts: [["最长路径", best]] });
  },
  points: [
    { t: "返回值和答案是两回事", body: "函数返回深度，答案存在外面的变量里。把 <code>l + r</code> 当返回值是最常见的错误。" },
    { t: "数的是边", body: "直径是路径上的边数，不是节点数。空节点深度记为 0 时，<code>l + r</code> 正好是边数。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)。" },
  ],
};
