const F = require("../fig");

module.exports = {
  id: 94, name: "二叉树的中序遍历", title: "二叉树的中序遍历图解", level: "简单", topic: "二叉树",
  h1: "二叉树的中序遍历，先左、再自己、最后右",
  lede: "中序遍历的规则对每个节点都一样：先把左子树整个走完，再记下自己，最后走右子树。递归写法只有三行，迭代写法是用一个栈把递归的过程手动模拟出来。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "inorder_1.jpg": [F.tree([1, null, 2, 3])],
  },
  hints: [
    { t: "三种遍历只差一行", body: ["前序：自己 → 左 → 右。中序：左 → 自己 → 右。后序：左 → 右 → 自己。", "区别只在「记下自己」这一行放在两次递归的前面、中间还是后面。"] },
    { t: "递归怎么写", body: ["函数 <code>dfs(node)</code>：节点为空就返回；否则先 <code>dfs(node.left)</code>，再把 <code>node.val</code> 放进结果，再 <code>dfs(node.right)</code>。"] },
    { t: "不用递归怎么写", body: ["一路往左走，把经过的节点都压进栈，直到左边没有节点。", "弹出栈顶，记下它，然后转向它的右孩子，重复上面的过程。"] },
  ],
  codes: [{ t: "标准解法：递归", code: `
class Solution:
    def inorderTraversal(self, root: Optional[TreeNode]) -> List[int]:
        res = []                        #@init
        def dfs(node):
            if not node:                #@enter
                return
            dfs(node.left)              # 左 #@enter
            res.append(node.val)        # 自己 #@visit
            dfs(node.right)             # 右 #@visit
        dfs(root)                       #@init
        return res                      #@done
` }, { t: "迭代写法：用栈模拟", key: "iter", code: `
class Solution:
    def inorderTraversal(self, root: Optional[TreeNode]) -> List[int]:
        res, stack, cur = [], [], root  #@init
        while cur or stack:
            while cur:                  # 一路向左，沿途入栈 #@left
                stack.append(cur)       #@left
                cur = cur.left          #@left
            cur = stack.pop()           #@pop
            res.append(cur.val)         #@pop
            cur = cur.right             # 转向右子树 #@pop
        return res                      #@done
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
  sig: { fn: "inorderTraversal", params: ["TreeNode"], ret: "List<int>" },
  call: (a, H) => [H.toLc(a.t)],
  cases: [[[]], [[1]], [[1, null, 2, 3]], [[1, 2, null, 3, null, 4]]],
  method: "递归",
  legend: [["e", "在调用栈上，还没记"], ["a", "当前节点"], ["c", "已经记进结果"]],
  presets: [
    { label: "示例 1", args: { t: [1, null, 2, null, null, 3] }, note: "root = [1,null,2,3]", expect: [1, 3, 2] },
    { label: "满二叉树", args: { t: [4, 2, 6, 1, 3, 5, 7] }, note: "root = [4,2,6,1,3,5,7]", expect: [1, 2, 3, 4, 5, 6, 7] },
  ],
  build(a, snap) {
    const N = {};
    a.t.forEach((v, i) => {
      if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
    });
    const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
    if (!N[0]) {
      snap("完成", "树是空的，中序遍历结果是 []。", [{ t: "note", label: "二叉树", html: "空" }], { at: "done", kind: "ok", ans: [], facts: [["已记数量", 0]] });
      return;
    }
    const res = [], st = {}, stack = [], order = {};
    const stackEdges = () => {
      const e = [];
      for (let i = 0; i + 1 < stack.length; i++) e.push([stack[i], stack[i + 1]]);
      return e;
    };
    const view = (cur, opts = {}) => {
      const cls = {};
      for (const id in N) cls[id] = +id === cur ? "a" : st[id] === "done" ? "c" : stack.includes(+id) ? "e" : "";
      return [
        {
          t: "tree",
          label: "二叉树中序遍历（左 → 自己 → 右）",
          nodes: snapNodes(),
          root: 0,
          cls,
          directed: true,
          lrLabels: true,
          on: stack.slice(),
          onEdges: stackEdges().concat(opts.onEdges || []),
          ptrs: { node: cur >= 0 ? cur : null },
          badges: { ...order },
        },
        {
          t: "chips",
          label: "结果（res）",
          items: res.map((v, i) => ({ v, cls: opts.newIdx === i ? "a" : "c" })),
          empty: "还没有",
        },
      ];
    };
    snap("开始", "从根节点开始。每个节点都按「左 → 自己 → 右」的顺序处理。", view(-1), {
      at: "init",
      facts: [["当前 node", "—"], ["调用栈深", 0], ["已记数量", 0]],
    });
    const dfs = (id) => {
      const nd = N[id];
      const prevDepth = stack.length;
      stack.push(id);
      snap(
        "进入",
        `进入 <b>${nd.v}</b>。` + (nd.l !== null ? `先沿左指针去左孩子 <b>${N[nd.l].v}</b>。` : "它没有左孩子，左边算走完了。"),
        view(id),
        {
          at: "enter",
          facts: [["当前 node", nd.v], ["调用栈深", stack.length, prevDepth], ["已记数量", res.length]],
        },
      );
      if (nd.l !== null) dfs(nd.l);
      const prevCnt = res.length;
      res.push(nd.v);
      st[id] = "done";
      order[id] = "第 " + res.length;
      snap(
        "记下自己",
        `${nd.v} 的左子树走完了，把 <b>${nd.v}</b> 记进结果。` + (nd.r !== null ? `接着沿右指针去右孩子 <b>${N[nd.r].v}</b>。` : "它没有右孩子，返回上一层。"),
        view(id, { newIdx: res.length - 1 }),
        {
          at: "visit",
          facts: [["当前 node", nd.v], ["调用栈深", stack.length], ["已记数量", res.length, prevCnt]],
        },
      );
      if (nd.r !== null) dfs(nd.r);
      stack.pop();
    };
    dfs(0);
    snap("完成", `中序遍历的结果是 [${res.join(", ")}]。`, view(-1), {
      at: "done",
      kind: "ok",
      ans: res,
      facts: [["调用栈深", 0], ["已记数量", res.length]],
    });
  },
  alts: [{
    t: "用栈模拟",
    code: "iter",
    note: "和迭代写法一样：cur 一路向左，沿途的节点入栈；走到空就弹出栈顶记下来，再转向它的右子树。栈做的就是递归时调用栈的事。",
    legend: [["e", "在栈里，还没记"], ["a", "cur"], ["c", "已经记进结果"]],
    build(a, snap) {
      const N = {};
      a.t.forEach((v, i) => {
        if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
      });
      const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
      if (!N[0]) {
        snap("完成", "树是空的，直接返回 []。", [{ t: "note", label: "二叉树", html: "空" }], { at: "done", kind: "ok", ans: [], facts: [["栈长度", 0], ["已记数量", 0]] });
        return;
      }
      const res = [], stack = [], done = new Set(), order = {};
      let cur = 0;
      const view = (hl, opts = {}) => {
        const cls = {};
        for (const id in N) cls[id] = +id === hl ? "a" : done.has(+id) ? "c" : stack.includes(+id) ? "e" : "";
        return [
          {
            t: "tree",
            label: "用栈模拟中序遍历",
            nodes: snapNodes(),
            root: 0,
            cls,
            directed: true,
            lrLabels: true,
            ptrs: { cur: hl >= 0 ? hl : null },
            badges: { ...order },
            ...(opts.onEdges && opts.onEdges.length ? { onEdges: opts.onEdges } : {}),
          },
          {
            t: "chips",
            label: "栈（右边是栈顶）",
            items: stack.map((id, i) => ({ v: N[id].v, cls: opts.pushTop && i === stack.length - 1 ? "a" : "e" })),
            empty: "空",
          },
          {
            t: "chips",
            label: "结果（res）",
            items: res.map((v, i) => ({ v, cls: opts.newIdx === i ? "a" : "c" })),
            empty: "还没有",
          },
        ];
      };
      snap("开始", `cur 指着根节点 <b>${N[0].v}</b>，栈是空的。`, view(cur), {
        at: "init",
        facts: [["cur", N[0].v], ["栈长度", 0], ["已记数量", 0]],
      });
      while (cur !== null || stack.length) {
        while (cur !== null) {
          const prevLen = stack.length;
          stack.push(cur);
          const nd = N[cur];
          snap(
            "一路向左",
            `<b>${nd.v}</b> 入栈。` + (nd.l !== null ? `cur 沿左指针走到 <b>${N[nd.l].v}</b>。` : "它没有左孩子，cur 变成空。"),
            view(cur, { pushTop: true, onEdges: nd.l !== null ? [[cur, nd.l]] : [] }),
            {
              at: "left",
              facts: [["cur", nd.v], ["栈长度", stack.length, prevLen], ["已记数量", res.length]],
            },
          );
          cur = nd.l;
        }
        const prevLen = stack.length;
        cur = stack.pop();
        const nd = N[cur];
        const prevCnt = res.length;
        res.push(nd.v);
        done.add(cur);
        order[cur] = "第 " + res.length;
        snap(
          "出栈记下",
          `cur 是空的，弹出栈顶 <b>${nd.v}</b>：它的左子树已经走完了，把 <b>${nd.v}</b> 记进结果。` + (nd.r !== null ? `cur 转向它的右孩子 <b>${N[nd.r].v}</b>。` : "它没有右孩子，cur 变成空，下一轮接着弹栈。"),
          view(cur, { newIdx: res.length - 1, onEdges: nd.r !== null ? [[cur, nd.r]] : [] }),
          {
            at: "pop",
            facts: [["cur", nd.v], ["栈长度", stack.length, prevLen], ["已记数量", res.length, prevCnt]],
          },
        );
        cur = nd.r;
      }
      snap("完成", `cur 是空的，栈也空了。中序遍历的结果是 [${res.join(", ")}]。`, view(-1), {
        at: "done",
        kind: "ok",
        ans: res,
        facts: [["cur", "空"], ["栈长度", 0], ["已记数量", res.length]],
      });
    },
  }],
  points: [
    { t: "二叉搜索树的中序是有序的", body: "对二叉搜索树做中序遍历，得到的正好是从小到大的序列。很多 BST 的题都靠这一点。" },
    { t: "迭代写法的循环条件", body: "<code>while cur or stack</code>：栈空了但 cur 还指着右子树时，遍历还没结束。" },
    { t: "复杂度", body: "每个节点访问一次，时间 O(n)。空间是树的高度，最坏 O(n)。" },
  ],
};
