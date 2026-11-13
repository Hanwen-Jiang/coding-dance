module.exports = {
  id: 199, name: "二叉树的右视图", title: "二叉树的右视图图解", level: "中等", topic: "二叉树",
  h1: "二叉树的右视图，每一层最右边的那个",
  lede: "站在右边看，每一层只能看到一个节点：这一层最右边的那个。它不一定在右子树里，左子树更深时，下面几层看到的就是左子树的节点。按层遍历，取每层最后一个即可。",
  hints: [
    { t: "看到的是什么", body: ["每一层看到的，是这一层从左往右数的最后一个节点。", "注意它可能在左子树里，比如右子树比左子树浅的时候。"] },
    { t: "按层遍历", body: ["用队列做 BFS，每次把一整层处理完。处理前队列里的最后一个节点，就是这一层最右边的。"] },
    { t: "也可以用 DFS", body: ["先右后左地递归，并记录深度。每一层第一次到达的节点就是最右边的：<code>depth == len(res)</code> 时把它加进结果。"] },
  ],
  codes: [{ t: "标准解法：BFS 按层遍历", code: `
class Solution:
    def rightSideView(self, root: Optional[TreeNode]) -> List[int]:
        res, q = [], deque([root] if root else [])
        while q:
            res.append(q[-1].val)           # 这一层最右边的节点
            for _ in range(len(q)):
                node = q.popleft()
                if node.left:
                    q.append(node.left)
                if node.right:
                    q.append(node.right)
        return res
` }, { t: "简洁写法：先右后左的 DFS", kind: "elegant", note: "每一层第一次到达时 depth 正好等于 len(res)。先走右边，所以先到的就是最右边的。", code: `
class Solution:
    def rightSideView(self, root: Optional[TreeNode]) -> List[int]:
        res = []
        def dfs(node, depth):
            if node:
                if depth == len(res):
                    res.append(node.val)
                dfs(node.right, depth + 1)
                dfs(node.left, depth + 1)
        dfs(root, 0)
        return res
` }],
  pytest: `
s = Solution()
assert s.rightSideView(T([1,2,3,None,5,None,4])) == [1,3,4]
assert s.rightSideView(T([1,2,3,4,None,None,None,5])) == [1,3,4,5]
assert s.rightSideView(T([1,None,3])) == [1,3]
assert s.rightSideView(T([])) == []
`,
  legend: [["e", "当前这一层"], ["c", "被看到的节点"]],
  presets: [
    { label: "示例 1", args: { t: [1, 2, 3, null, 5, null, 4] }, note: "root = [1,2,3,null,5,null,4]", expect: [1, 3, 4] },
    { label: "左边更深", args: { t: [1, 2, 3, 4] }, note: "root = [1,2,3,4]", expect: [1, 3, 4] },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const res = [], seen = new Set(); let level = [0];
    const view = (cur) => { const cls = {}; for (const id in N) cls[id] = seen.has(+id) ? "c" : cur.includes(+id) ? "e" : ""; return [{ t: "tree", nodes: N, root: 0, cls }, { t: "chips", label: "右视图", items: res.slice(), empty: "还没有" }]; };
    snap("开始", "从根节点这一层开始，一层一层往下。", view([]));
    let d = 0;
    while (level.length) {
      const last = level[level.length - 1];
      snap(`第 ${d} 层`, `这一层有 ${level.map((i) => N[i].v).join("、")}，从右边看过来，最先看到的是最右边的 <b>${N[last].v}</b>。`, view(level));
      res.push(N[last].v); seen.add(last);
      const nx = [];
      for (const i of level) { if (N[i].l !== null) nx.push(N[i].l); if (N[i].r !== null) nx.push(N[i].r); }
      level = nx; d++;
    }
    snap("完成", `右视图是 [${res.join(", ")}]。`, view([]), { kind: "ok", ans: res.slice() });
  },
  points: [
    { t: "先记长度再出队", body: "<code>for _ in range(len(q))</code> 在循环开始时就固定了这一层的节点数，新入队的下一层节点不会混进来。" },
    { t: "不是一路往右走", body: "只看右孩子会漏掉左子树更深的部分，第二个示例就是这种情况。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)。BFS 空间是最宽一层的节点数。" },
  ],
};
