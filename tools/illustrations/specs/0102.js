const F = require("../fig");

module.exports = {
  id: 102, name: "二叉树的层序遍历", title: "二叉树的层序遍历图解", level: "中等", topic: "二叉树",
  h1: "二叉树的层序遍历，用队列一层层往下推",
  lede: "队列先进先出，正好适合一层层地走：把一层的节点依次取出来，同时把它们的孩子放到队尾，取完时队列里就全是下一层的节点。关键是每层开始前先记下队列的长度，这样才知道这一层到哪里结束。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "tree1.jpg": [F.tree([3, 9, 20, null, null, 15, 7])],
  },
  hints: [
    { t: "为什么用队列", body: ["先看到的节点，它的孩子也应该先被处理。队列先进先出，正好保证这个顺序。", "这就是广度优先搜索（BFS）。"] },
    { t: "怎么分出每一层", body: ["处理一层之前，队列里装的正好是这一层的全部节点。", "先记下这时的长度 <code>n</code>，然后只取 <code>n</code> 次。这 <code>n</code> 个节点的孩子进队后，就是下一层。"] },
    { t: "孩子的入队顺序", body: ["先左孩子后右孩子，这样每一层都是从左到右。"] },
  ],
  codes: [{ t: "标准解法：BFS，按层处理", code: `
class Solution:
    def levelOrder(self, root: Optional[TreeNode]) -> List[List[int]]:
        if not root:
            return []
        res, q = [], deque([root])      #@init
        while q:
            level = []                  #@level
            for _ in range(len(q)):     # 这一层有 len(q) 个节点 #@level
                node = q.popleft()      #@pop
                level.append(node.val)  #@pop
                if node.left:           #@push
                    q.append(node.left)     #@push
                if node.right:          #@push
                    q.append(node.right)    #@push
            res.append(level)           #@end
        return res                      #@done
` }, { t: "简洁写法：用列表代替队列", kind: "elegant", note: "level 是这一层的节点，下一层用列表推导一次生成。", code: `
class Solution:
    def levelOrder(self, root: Optional[TreeNode]) -> List[List[int]]:
        res, level = [], [root] if root else []
        while level:
            res.append([n.val for n in level])
            level = [c for n in level for c in (n.left, n.right) if c]
        return res
` }],
  pytest: `
s = Solution()
assert s.levelOrder(T([3,9,20,None,None,15,7])) == [[3],[9,20],[15,7]]
assert s.levelOrder(T([1])) == [[1]]
assert s.levelOrder(T([])) == []
assert s.levelOrder(T([1,2,3,4,None,None,5])) == [[1],[2,3],[4,5]]
`,
  sig: { fn: "levelOrder", params: ["TreeNode"], ret: "List<List<int>>" },
  call: (a, H) => [H.toLc(a.t)],
  cases: [[[]], [[1]]],
  legend: [["a", "刚出队的节点"], ["e", "在队列里"], ["c", "已经处理完"]],
  presets: [
    { label: "示例 1", args: { t: [3, 9, 20, null, null, 15, 7] }, note: "root = [3,9,20,null,null,15,7]", expect: [[3], [9, 20], [15, 7]] },
    { label: "三层都满", args: { t: [1, 2, 3, 4, 5, 6, 7] }, note: "root = [1,2,3,4,5,6,7]", expect: [[1], [2, 3], [4, 5, 6, 7]] },
  ],
  build(a, snap) {
    const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
    const q = [0], res = [], done = new Set(); let level = [];
    const view = (cur) => { const cls = {}; for (const id in N) cls[id] = +id === cur ? "a" : q.includes(+id) ? "e" : done.has(+id) ? "c" : ""; return [
      { t: "tree", nodes: N, root: 0, cls },
      { t: "chips", label: "队列（左边先出）", items: q.map((id) => N[id].v) },
      { t: "chips", label: "这一层", items: level.slice(), empty: "空" },
      { t: "chips", label: "结果", items: res.map((l) => `[${l.join(", ")}]`), empty: "还没有" },
    ]; };
    snap("开始", "先把根节点放进队列。", view(-1), { at: "init" });
    while (q.length) {
      const n = q.length; level = [];
      snap(`第 ${res.length + 1} 层开始`, `队列里现在有 ${n} 个节点，它们就是第 ${res.length + 1} 层。接下来正好取 ${n} 次。`, view(-1), { at: "level", facts: [["这一层的节点数", n]] });
      for (let t = 0; t < n; t++) {
        const id = q.shift(), nd = N[id], kids = [nd.l, nd.r].filter((c) => c !== null);
        level.push(nd.v); kids.forEach((c) => q.push(c)); done.add(id);
        snap("出队", `取出 ${nd.v}，记进这一层。` + (kids.length ? `把它的孩子 ${kids.map((c) => N[c].v).join("、")} 放到队尾。` : "它没有孩子。"), view(id), { at: kids.length ? ["pop", "push"] : "pop", facts: [["这一层的节点数", n], ["已取", t + 1]] });
      }
      res.push(level); level = [];
      snap("这一层结束", `取够了 ${n} 个，这一层是 [${res[res.length - 1].join(", ")}]。` + (q.length ? "队列里剩下的全是下一层的节点。" : "队列空了。"), view(-1), { at: "end" });
    }
    snap("完成", `一共 ${res.length} 层。`, view(-1), { at: "done", kind: "ok", ans: res });
  },
  points: [
    { t: "先固定这一层的长度", body: "<code>for _ in range(len(q))</code> 里的长度只算一次。循环中队列在变长，但不影响这一层的次数。" },
    { t: "用 deque", body: "列表的 <code>pop(0)</code> 是 O(n)，<code>deque.popleft()</code> 是 O(1)。" },
    { t: "空树", body: "根节点为空时直接返回空列表，否则会把 None 放进队列。" },
  ],
};
