const F = require("../fig");

module.exports = {
  id: 114, name: "二叉树展开为链表", title: "二叉树展开为链表图解", level: "中等", topic: "二叉树",
  h1: "二叉树展开为链表，把左子树插到右边",
  lede: "展开后的顺序是前序遍历。对当前节点：如果有左子树，就把原来的右子树接到左子树最右边的节点后面，再把整个左子树挪到右边。然后沿右指针往下走，重复这个过程。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "flaten.jpg": [F.row([F.tree([1, 2, 5, 3, 4, null, 6]), F.tree([1, null, 2, null, 3, null, 4, null, 5, null, 6])], { label: "按先序遍历的顺序，展开成只有右孩子的「链表」" })],
  },
  hints: [
    { t: "目标顺序", body: ["展开后的链表按前序（根 → 左 → 右）排列，全部用 <code>right</code> 指针串起来，<code>left</code> 都是空。"] },
    { t: "一个节点怎么处理", body: ["节点 <code>cur</code> 有左子树时：左子树里前序最后一个节点，就是左子树最右边的节点 <code>pre</code>。", "原来的右子树应该接在 <code>pre</code> 后面：<code>pre.right = cur.right</code>。然后 <code>cur.right = cur.left</code>，<code>cur.left = None</code>。"] },
    { t: "往下走", body: ["处理完 <code>cur</code> 后走到 <code>cur.right</code>，继续同样的处理，直到走到空。整个过程只用 O(1) 额外空间。"] },
  ],
  codes: [{ t: "标准解法：原地挪左子树", code: `
class Solution:
    def flatten(self, root: Optional[TreeNode]) -> None:
        cur = root                          #@init
        while cur:
            if cur.left:                    #@check
                pre = cur.left              #@pre0
                while pre.right:            # 左子树最右边的节点
                    pre = pre.right         #@prestep
                pre.right = cur.right       # 原来的右子树接到它后面 #@hook
                cur.right = cur.left        # 左子树挪到右边 #@move
                cur.left = None             # 断开左指针 #@clear
            cur = cur.right                 #@next
` }, { t: "简洁写法：反向前序", key: "rev", kind: "elegant", note: "按 右 → 左 → 根 的顺序访问，正好是前序倒过来，也就是从链表尾往头。每个节点接上一个访问的节点就行。", code: `
class Solution:
    def flatten(self, root: Optional[TreeNode]) -> None:
        prev = None                         #@init
        def dfs(node):
            nonlocal prev
            if node:
                dfs(node.right)             #@goR
                dfs(node.left)              #@goL
                node.right = prev           #@linkR
                node.left = None            #@clearL
                prev = node                 #@setP
        dfs(root)                           #@init
` }],
  sig: { fn: "flatten", params: ["TreeNode"], ret: "void" },
  call: (a, H) => [H.toLc(a.t)],
  cases: [[[]], [[0]], [[1, 2, null, 3]], [[1, null, 2, 3]]],
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
  method: "原地挪左子树",
  legend: [["a", "当前节点 cur"], ["b", "左子树最右节点 pre"], ["e", "正在处理的子树"], ["c", "已经展开好的部分"]],
  presets: [
    { label: "示例 1", args: { t: [1, 2, 5, 3, 4, null, 6] }, note: "root = [1,2,5,3,4,null,6]", expect: [1, 2, 3, 4, 5, 6] },
    { label: "满二叉树", args: { t: [1, 2, 3, 4, 5, 6, 7] }, note: "root = [1,2,3,4,5,6,7]", expect: [1, 2, 4, 5, 3, 6, 7] },
  ],
  build(a, snap) {
    const N = {};
    a.t.forEach((v, i) => {
      if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
    });
    const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
    const done = new Set();
    const view = (cur, pre, opts = {}) => {
      const cls = {};
      for (const id in N) {
        const nid = +id;
        cls[id] = nid === cur ? "a" : nid === pre ? "b" : done.has(nid) ? "c" : (opts.leftSub && opts.leftSub.has(nid)) ? "e" : "";
      }
      return [{
        t: "tree",
        label: "二叉树（带 L/R 方向与指针改接动画）",
        nodes: snapNodes(),
        root: N[0] ? 0 : null,
        cls,
        directed: true,
        lrLabels: true,
        ptrs: { cur: cur >= 0 ? cur : null, pre: pre >= 0 ? pre : null },
        ...(opts.prevNodes ? { prevNodes: opts.prevNodes } : {}),
        ...(opts.onEdges ? { onEdges: opts.onEdges } : {}),
        ...(opts.extra ? { extra: opts.extra } : {}),
        ...(opts.cutEdges ? { cutEdges: opts.cutEdges } : {}),
        ...(opts.animEdges ? { animEdges: opts.animEdges } : {}),
        ...(opts.on ? { on: opts.on } : {}),
      }];
    };
    const collectSub = (id, out = new Set()) => {
      if (id === null || id === undefined || !N[id] || out.has(id)) return out;
      out.add(id);
      collectSub(N[id].l, out);
      collectSub(N[id].r, out);
      return out;
    };

    if (!N[0]) {
      snap("完成", "树是空的，不需要展开。", [{ t: "note", label: "二叉树", html: "空" }], { at: "init", kind: "ok", ans: [] });
      return;
    }

    snap("cur = root", `从根节点 <b>${N[0].v}</b> 开始，沿着 right 指针一路往下展开。`, view(0, -1), { at: "init" });
    let cur = 0;
    while (cur !== null) {
      const nd = N[cur];
      if (nd.l !== null) {
        const leftSub = collectSub(nd.l);
        snap("检查左子树", `cur 在 <b>${nd.v}</b>，它有左子树（浅蓝部分）。我们需要把整个左子树插到 ${nd.v} 和原右子树之间。`, view(cur, -1, { leftSub }), { at: "check" });

        let pre = nd.l;
        snap("pre = cur.left", `pre 从 ${nd.v} 的左孩子 <b>${N[pre].v}</b> 出发，往右寻找左子树最右边的节点（前序遍历的最后一个）。`, view(cur, pre, { leftSub, on: [cur, pre] }), { at: "pre0" });

        while (N[pre].r !== null) {
          const nxt = N[pre].r;
          snap("pre = pre.right", `pre 还有右孩子，继续往右走到 <b>${N[nxt].v}</b>。`, view(cur, nxt, { leftSub, on: [pre, nxt] }), { at: "prestep" });
          pre = nxt;
        }

        const oldLeft = nd.l;
        const oldRight = nd.r;

        if (oldRight !== null) {
          snap(
            "pre.right = cur.right",
            `找到了最右节点 pre = <b>${N[pre].v}</b>。先让 ${N[pre].v}.right 接上 cur 原来的右子树 <b>${N[oldRight].v}</b>（先接好它，后面改 ${nd.v}.right 时才不会丢掉右子树）。`,
            view(cur, pre, {
              leftSub,
              extra: [{ from: pre, to: oldRight, cls: "on", anim: "draw", bend: 0.36, label: "right" }],
            }),
            { at: "hook" },
          );
        } else {
          snap(
            "pre.right = cur.right",
            `找到了最右节点 pre = <b>${N[pre].v}</b>。${nd.v} 原来没有右子树（cur.right 为空），所以 ${N[pre].v}.right 保持空。`,
            view(cur, pre, { leftSub }),
            { at: "hook" },
          );
        }

        snap(
          "cur.right = cur.left",
          `现在让 ${nd.v}.right 改指向左孩子 <b>${N[oldLeft].v}</b>${oldRight !== null ? `（断开 ${nd.v} 原先指往 ${N[oldRight].v} 的右指针，${N[pre].v}.right 已接好 ${N[oldRight].v}）` : ""}。`,
          view(cur, pre, {
            leftSub,
            ...(oldRight !== null ? { cutEdges: [[cur, oldRight]] } : {}),
            extra: [
              ...(oldRight !== null ? [{ from: pre, to: oldRight, cls: "on", bend: 0.36, label: "right" }] : []),
              { from: cur, to: oldLeft, cls: "on", anim: "draw", bend: -0.38, label: "新 right" },
            ],
          }),
          { at: "move" },
        );

        // 先记下改指针前的树结构，改完后用 prevNodes 做整棵树的平滑展开过渡（可重播）
        const beforeNodes = snapNodes();
        N[pre].r = oldRight;
        nd.r = oldLeft;
        nd.l = null;
        snap(
          "cur.left = None",
          `把 ${nd.v}.left 置空：整棵左子树（以 <b>${N[oldLeft].v}</b> 为根）顺着新 right 指针整体移到 ${nd.v} 右侧${oldRight !== null ? `，原来的右子树（以 <b>${N[oldRight].v}</b> 为根）顺势挂在 ${N[pre].v} 右边` : ""}。可点「重播本步」反复看挪动过程。`,
          view(cur, pre, {
            prevNodes: beforeNodes,
            onEdges: [[cur, oldLeft], ...(oldRight !== null ? [[pre, oldRight]] : [])],
          }),
          { at: "clear" },
        );
      } else {
        snap("没有左子树", `cur 在 <b>${nd.v}</b>，没有左子树需要挪，直接沿 right 往下走即可。`, view(cur, -1), { at: "check" });
      }

      done.add(cur);
      const nxtCur = N[cur].r;
      snap("cur = cur.right", nxtCur !== null ? `${nd.v} 处理完毕，cur 沿 right 走到 <b>${N[nxtCur].v}</b>。` : `${nd.v} 处理完毕，cur 走到空，整棵树已经展开完成。`, view(nxtCur ?? -1, -1), { at: "next" });
      cur = nxtCur;
    }

    const out = [];
    let p = 0;
    while (p !== null) { out.push(N[p].v); p = N[p].r; }
    snap("完成", `展开成了一条只用 right 指针的链：${out.join(" → ")}，正是前序遍历的顺序。`, [
      ...view(-1, -1),
      { t: "list", label: "展开后的单链表（全部为 right 指针）", nodes: out.map((v) => ({ v, cls: "c" })) },
    ], { at: [], kind: "ok", ans: out });
  },
  alts: [{
    t: "反向前序",
    code: "rev",
    note: "和简洁写法一样：按 右 → 左 → 自己 的顺序访问，正好是前序倒过来，也就是从链表的尾巴往头走。每访问一个节点，就先让它的 right 指向 prev，再把 left 置空，最后更新 prev = node。",
    legend: [["e", "在调用栈上"], ["a", "当前回溯到的 node"], ["b", "prev（上一串好的头）"], ["c", "已经串进链表"]],
    build(a, snap) {
      const N = {};
      a.t.forEach((v, i) => {
        if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
      });
      if (!N[0]) {
        snap("完成", "树是空的，直接返回。", [{ t: "note", label: "二叉树", html: "空" }], { at: "init", kind: "ok", ans: [] });
        return;
      }
      const stack = [], done = new Set(), link = {};
      const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
      let prev = null;
      const chain = () => { const out = []; for (let p = prev; p !== null; p = link[p]) out.push(N[p].v); return out; };
      const view = (cur, opts = {}) => {
        const cls = {}, c = chain();
        const shownPrev = opts.prevPtr !== undefined ? opts.prevPtr : prev;
        for (const id in N) {
          const nid = +id;
          cls[id] = nid === cur ? "a" : nid === shownPrev ? "b" : done.has(nid) ? "c" : stack.includes(nid) ? "e" : "";
        }
        return [
          {
            t: "tree",
            label: "递归遍历与指针重连（虚线箭头是新串好的 right 指向）",
            nodes: snapNodes(),
            root: 0,
            cls,
            directed: true,
            lrLabels: true,
            on: stack.slice(),
            ptrs: { node: cur >= 0 ? cur : null, prev: shownPrev !== null ? shownPrev : null },
            ...(opts.extra ? { extra: opts.extra } : {}),
            ...(opts.cutEdges ? { cutEdges: opts.cutEdges } : {}),
          },
          c.length
            ? {
                t: "list",
                label: "已经串好的链（从 prev 开始，只用 right 指针）",
                nodes: c.map((v, i) => ({ v, cls: i === 0 && opts.newHead ? "a" : "c" })),
                ...(opts.animHead ? { animEdges: [0] } : {}),
              }
            : { t: "note", label: "已经串好的链", html: "还没有（先深入到最右边的叶子）" },
        ];
      };

      snap("prev = None", "前序是 根 → 左 → 右。反过来按 右 → 左 → 根 访问，就会先拿到链表尾巴。一开始 prev 为空。", view(-1), { at: "init", facts: [["prev", "空"]] });
      const dfs = (id) => {
        if (id === null) return;
        const nd = N[id];
        stack.push(id);
        if (nd.r !== null) {
          snap("dfs(node.right)", `到达 <b>${nd.v}</b>，按 右 → 左 → 根 的顺序，先递归右孩子 <b>${N[nd.r].v}</b>。`, view(id), { at: "goR", facts: [["当前 node", nd.v], ["prev", prev === null ? "空" : N[prev].v]] });
          dfs(nd.r);
        }
        if (nd.l !== null) {
          snap("dfs(node.left)", `回到 <b>${nd.v}</b>（右子树已处理完），接下来递归左孩子 <b>${N[nd.l].v}</b>。`, view(id), { at: "goL", facts: [["当前 node", nd.v], ["prev", prev === null ? "空" : N[prev].v]] });
          dfs(nd.l);
        }

        const old = prev;
        const oldName = old === null ? "空" : N[old].v;
        link[id] = prev;
        done.add(id);
        const prevBackup = prev;
        prev = id;
        snap(
          "node.right = prev",
          `${nd.v} 的右、左子树都已展开。让 ${nd.v}.right 指向当前的 prev（<b>${oldName}</b>）。`,
          view(id, {
            prevPtr: prevBackup,
            newHead: true,
            animHead: old !== null,
            extra: old !== null ? [{ from: id, to: old, cls: "on", anim: "draw", bend: 0.35, label: "right" }] : [],
          }),
          { at: "linkR", facts: [["当前 node", nd.v], ["prev", oldName]] },
        );

        const hadLeft = nd.l !== null;
        snap(
          "node.left = None",
          hadLeft ? `断开 ${nd.v} 原来的左指针（${nd.v}.left = None），避免树里留下分支或环。` : `${nd.v}.left 置空（本来就是空）。`,
          view(id, {
            prevPtr: prevBackup,
            cutEdges: hadLeft ? [[id, nd.l]] : [],
          }),
          { at: "clearL", facts: [["当前 node", nd.v], ["prev", oldName]] },
        );
        nd.l = null;

        snap(
          "prev = node",
          `把 prev 前移到 <b>${nd.v}</b>（它现在是已串好链表的新头部），准备返回上一层。`,
          view(id, { newHead: true }),
          { at: "setP", facts: [["当前 node", nd.v], ["prev", nd.v, prevBackup === null ? "空" : N[prevBackup].v]] },
        );
        stack.pop();
      };
      dfs(0);
      const out = chain();
      snap("完成", `展开成了一条只用 right 指针的链：${out.join(" → ")}，正是前序遍历的顺序。`, view(-1), { at: [], kind: "ok", ans: out, facts: [["prev", N[prev].v]] });
    },
  }],
  points: [
    { t: "先接右子树再挪左子树", body: "顺序反了的话，原来的右子树会丢掉。" },
    { t: "left 要置空", body: "题目要求左指针都是 null，挪完后记得 <code>cur.left = None</code>。" },
    { t: "复杂度", body: "每个节点最多被当成 pre 走过一次，时间 O(n)，空间 O(1)。" },
  ],
};
