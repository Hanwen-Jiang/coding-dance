const F = require("../fig");

module.exports = {
  id: 101, name: "对称二叉树", title: "对称二叉树图解", level: "简单", topic: "二叉树",
  h1: "对称二叉树，两个指针照镜子一样走",
  lede: "判断一棵树是否左右对称，就是判断它的左子树和右子树是不是互为镜像。用两个指针同时往下走：一个往左时另一个往右，一个往右时另一个往左，每一步都比较两个节点。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "1698026966-JDYPDU-image.png": [F.tree([1, 2, 2, 3, 4, 4, 3], { label: "左右两边互为镜像", cls: (v, i) => ([1, 3, 4].includes(i) ? "e" : i ? "g" : "") })],
    "1698027008-nPFLbM-image.png": [F.tree([1, 2, 2, null, 3, null, 3], { label: "两个 3 都在右边，不是镜像", cls: (v, i) => (i === 1 || i === 4 ? "e" : i ? "g" : "") })],
  },
  hints: [
    { t: "换成比较两棵树", body: ["整棵树对称 ⇔ 根节点的左子树和右子树互为镜像。", "所以需要一个比较两个节点的函数 <code>check(a, b)</code>。"] },
    { t: "两个节点互为镜像的条件", body: ["两个都是空：是镜像。", "只有一个是空，或者值不相等：不是。", "值相等：还要看 <code>a 的左</code> 和 <code>b 的右</code> 是否镜像，<code>a 的右</code> 和 <code>b 的左</code> 是否镜像。"] },
    { t: "注意是外侧配外侧", body: ["比较的是 <code>a.left</code> 和 <code>b.right</code>（两个外侧），<code>a.right</code> 和 <code>b.left</code>（两个内侧）。", "写成 <code>a.left</code> 比 <code>b.left</code> 就变成判断两棵树是否相同了。"] },
  ],
  codes: [{ t: "标准解法：递归比较一对节点", code: `
class Solution:
    def isSymmetric(self, root: Optional[TreeNode]) -> bool:
        def check(a, b):
            if not a and not b:         #@both
                return True             #@both
            if not a or not b or a.val != b.val:    #@diff
                return False            #@diff
            return check(a.left, b.right) and check(a.right, b.left)   #@same
        return check(root.left, root.right)     #@start
` }, { t: "简洁写法：a is b 处理空节点", kind: "elegant", note: "两个里至少有一个是空时，只有两个都空才对称，正好是 a is b。", code: `
class Solution:
    def isSymmetric(self, root: Optional[TreeNode]) -> bool:
        def mirror(a, b):
            if not a or not b:
                return a is b
            return a.val == b.val and mirror(a.left, b.right) and mirror(a.right, b.left)
        return mirror(root.left, root.right)
` }],
  pytest: `
s = Solution()
assert s.isSymmetric(T([1,2,2,3,4,4,3])) is True
assert s.isSymmetric(T([1,2,2,None,3,None,3])) is False
assert s.isSymmetric(T([1])) is True
assert s.isSymmetric(T([1,2,3])) is False
`,
  sig: { fn: "isSymmetric", params: ["TreeNode"], ret: "bool" },
  call: (a, H) => [H.toLc(a.t)],
  cases: [[[1]], [[1, 2, 3]], [[1, 2, 2, 2, null, 2]], [[1, 0]]],
  legend: [["a", "左边的指针 a"], ["b", "右边的指针 b"], ["k", "这一对比较通过"], ["w", "这一对不对称"]],
  presets: [
    { label: "示例 1", args: { t: [1, 2, 2, 3, 4, 4, 3] }, note: "root = [1,2,2,3,4,4,3]", expect: true },
    { label: "示例 2", args: { t: [1, 2, 2, null, 3, null, 3] }, note: "root = [1,2,2,null,3,null,3]", expect: false },
  ],
  build(a, snap) {
    const N = {};
    a.t.forEach((v, i) => {
      if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
    });
    const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
    if (!N[0]) {
      snap("完成", "空树是对称的。", [{ t: "note", label: "二叉树", html: "空" }], { at: "start", kind: "ok", ans: true, facts: [["结果", "true"]] });
      return;
    }
    const st = {}, pairBadge = {}, edgesA = [], edgesB = [];
    let pairNo = 0, prevA, prevB;
    const nm = (id) => (id === null || id === undefined ? "空" : N[id].v);
    const view = (x, y) => {
      const cls = {};
      for (const id in N) cls[id] = +id === x ? (st[id] === "w" ? "w" : "a") : +id === y ? (st[id] === "w" ? "w" : "b") : st[id] || "";
      const activeEdges = [...edgesA, ...edgesB];
      return [{
        t: "tree",
        label: "镜像双指针比较（外侧配外侧，内侧配内侧）",
        nodes: snapNodes(),
        root: 0,
        cls,
        directed: true,
        lrLabels: true,
        ptrs: { a: x !== null && x >= 0 ? x : null, b: y !== null && y >= 0 ? y : null },
        ...(activeEdges.length ? { onEdges: activeEdges } : {}),
        badges: { ...pairBadge },
      }];
    };
    const pairFacts = (x, y, extra = []) => {
      const curA = nm(x), curB = nm(y);
      const fa = prevA !== undefined && prevA !== curA ? ["指针 a", curA, prevA] : ["指针 a", curA];
      const fb = prevB !== undefined && prevB !== curB ? ["指针 b", curB, prevB] : ["指针 b", curB];
      prevA = curA;
      prevB = curB;
      return [fa, fb, ...extra];
    };
    snap("开始", "a 从根的左孩子出发，b 从根的右孩子出发，照镜子一样同步往下走。", view(-1, -1), {
      at: "start",
      facts: [["指针 a", nm(N[0].l)], ["指针 b", nm(N[0].r)]],
    });
    prevA = nm(N[0].l);
    prevB = nm(N[0].r);
    const check = (x, y, parX, parY, where) => {
      const pushA = x !== null && parX !== null;
      const pushB = y !== null && parY !== null;
      if (pushA) edgesA.push([parX, x]);
      if (pushB) edgesB.push([parY, y]);
      if (x === null && y === null) {
        snap("都是空", `${where}：两边都是空，对称。`, view(null, null), {
          at: "both",
          facts: pairFacts(null, null, [["判定", "都为空（对称）"]]),
        });
        if (pushA) edgesA.pop();
        if (pushB) edgesB.pop();
        return true;
      }
      if (x === null || y === null) {
        if (x !== null) st[x] = "w";
        if (y !== null) st[y] = "w";
        snap("不对称", `${where}：一边是 <b>${nm(x)}</b>，另一边是 <b>${nm(y)}</b>。只有一边有节点，<b>不对称</b>。`, view(x, y), {
          at: "diff",
          kind: "warn",
          facts: pairFacts(x, y, [["判定", "一空一非空"]]),
        });
        if (pushA) edgesA.pop();
        if (pushB) edgesB.pop();
        return false;
      }
      if (N[x].v !== N[y].v) {
        st[x] = st[y] = "w";
        snap("不对称", `${where}：a 是 <b>${N[x].v}</b>，b 是 <b>${N[y].v}</b>，值不相等，<b>不对称</b>。`, view(x, y), {
          at: "diff",
          kind: "warn",
          facts: pairFacts(x, y, [["判定", `${N[x].v} ≠ ${N[y].v}`]]),
        });
        if (pushA) edgesA.pop();
        if (pushB) edgesB.pop();
        return false;
      }
      pairNo += 1;
      pairBadge[x] = pairBadge[y] = "对 " + pairNo;
      snap("值相等", `${where}：a 是 <b>${N[x].v}</b>，b 是 <b>${N[y].v}</b>，值相等。接着比较外侧的一对，再比较内侧的一对。`, view(x, y), {
        at: "same",
        facts: pairFacts(x, y, [["配对", `第 ${pairNo} 对相等`]]),
      });
      st[x] = st[y] = "k";
      const ok =
        check(N[x].l, N[y].r, x, y, `${N[x].v} 的左 和 ${N[y].v} 的右（外侧）`) &&
        check(N[x].r, N[y].l, x, y, `${N[x].v} 的右 和 ${N[y].v} 的左（内侧）`);
      if (pushA) edgesA.pop();
      if (pushB) edgesB.pop();
      return ok;
    };
    const ans = check(N[0].l, N[0].r, 0, 0, "根的左孩子和右孩子");
    snap("完成", ans ? "所有成对的节点都比较通过，这棵树是对称的。" : "发现一对不对称的节点，后面不用再比，返回 false。", view(-1, -1), {
      at: "start",
      kind: ans ? "ok" : "warn",
      ans,
      facts: [["结果", ans ? "true（对称）" : "false（不对称）"]],
    });
  },
  points: [
    { t: "先判空再比值", body: "先处理两个都为空、只有一个为空的情况，之后才能放心访问 <code>.val</code>。" },
    { t: "and 会短路", body: "外侧那一对不对称时，内侧那一对不会再比较。" },
    { t: "迭代写法", body: "用队列，每次放进一对节点，取出来比较，再把外侧一对和内侧一对放进去。" },
  ],
};
