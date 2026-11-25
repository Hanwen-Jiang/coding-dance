const F = require("../fig");

module.exports = {
  id: 98, name: "验证二叉搜索树", title: "验证二叉搜索树图解", level: "中等", topic: "二叉树",
  h1: "验证二叉搜索树，每个节点都带着一个允许的范围",
  lede: "只比较节点和它的左右孩子是不够的：右子树里的所有节点都必须比根大，不只是右孩子。往下走的时候，把祖先给出的限制一路带下去，每个节点的值必须落在一个开区间里。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "tree1.jpg": [F.tree([2, 1, 3], { label: "左边都比 2 小，右边都比 2 大" })],
    "tree2.jpg": [F.tree([5, 1, 4, null, null, 3, 6], { label: "根是 5，右孩子却是 4，比 5 小", cls: { 4: "w", 5: "e" } })],
  },
  hints: [
    { t: "常见的错误做法", body: ["只检查 <code>左孩子 &lt; 自己 &lt; 右孩子</code> 是错的。", "比如根是 5，右孩子是 6，6 的左孩子是 3。每个节点和自己的孩子比都没问题，但 3 在 5 的右子树里却比 5 小。"] },
    { t: "带着范围往下走", body: ["给每个节点一个允许的范围 <code>(lo, hi)</code>，根节点是 <code>(−∞, +∞)</code>。", "往左走：上界收紧成当前节点的值。往右走：下界收紧成当前节点的值。"] },
    { t: "另一种做法", body: ["二叉搜索树的中序遍历是严格递增的。", "做一次中序遍历，检查每个值是否都大于前一个值。"] },
  ],
  codes: [{ t: "标准解法：递归传上下界", code: `
class Solution:
    def isValidBST(self, root: Optional[TreeNode]) -> bool:
        def check(node, lo, hi):
            if not node:
                return True
            if not (lo < node.val < hi):    #@range
                return False                #@bad
            return check(node.left, lo, node.val) and check(node.right, node.val, hi)  #@down
        return check(root, float("-inf"), float("inf"))     #@start
` }, { t: "另一种写法：中序遍历要严格递增", key: "inorder", code: `
class Solution:
    def isValidBST(self, root: Optional[TreeNode]) -> bool:
        prev = float("-inf")            #@init
        def inorder(node):
            nonlocal prev
            if not node:
                return True
            if not inorder(node.left):
                return False
            if node.val <= prev:        # 必须比前一个大 #@bad
                return False            #@bad
            prev = node.val             #@ok
            return inorder(node.right)
        return inorder(root)            #@done
` }, { t: "简洁写法：上下界当默认参数", kind: "elegant", code: `
class Solution:
    def isValidBST(self, root: Optional[TreeNode], lo=float("-inf"), hi=float("inf")) -> bool:
        if not root:
            return True
        return (lo < root.val < hi
                and self.isValidBST(root.left, lo, root.val)
                and self.isValidBST(root.right, root.val, hi))
` }],
  pytest: `
s = Solution()
assert s.isValidBST(T([2,1,3])) is True
assert s.isValidBST(T([5,1,4,None,None,3,6])) is False
assert s.isValidBST(T([5,4,6,None,None,3,7])) is False
assert s.isValidBST(T([1,1])) is False
assert s.isValidBST(T([2147483647])) is True
`,
  sig: { fn: "isValidBST", params: ["TreeNode"], ret: "bool" },
  call: (a, H) => [H.toLc(a.t)],
  // 不用 -2147483648：C++ 判题器拿它表示层序里的空位
  cases: [[[2147483647]], [[1, 1]], [[2147483647, 2147483647]], [[-2147483647, null, 2147483647]], [[5, 1, 4, null, null, 3, 6]], [[0, -1]]],
  method: "递归传上下界",
  legend: [["a", "当前节点"], ["c", "在允许的范围内"], ["w", "超出范围"]],
  presets: [
    { label: "示例 1", args: { t: [2, 1, 3] }, note: "root = [2,1,3]", expect: true },
    { label: "孩子都对，孙子不对", args: { t: [5, 4, 6, null, null, 3, 7] }, note: "root = [5,4,6,null,null,3,7]", expect: false },
    { label: "合法的大一点的树", args: { t: [8, 4, 12, 2, 6, 10, 14] }, note: "root = [8,4,12,2,6,10,14]", expect: true },
  ],
  build(a, snap) {
    const N = {};
    a.t.forEach((v, i) => {
      if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
    });
    const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
    if (!N[0]) {
      snap("完成", "空树是合法的二叉搜索树。", [{ t: "note", label: "二叉树", html: "空" }], { at: "start", kind: "ok", ans: true, facts: [["结果", "true"]] });
      return;
    }
    const st = {}, rng = {}, stack = [];
    const f = (x) => (x === -Infinity ? "−∞" : x === Infinity ? "+∞" : x);
    const stackEdges = () => {
      const e = [];
      for (let i = 0; i + 1 < stack.length; i++) e.push([stack[i], stack[i + 1]]);
      return e;
    };
    const view = (cur) => {
      const cls = {};
      for (const id in N) cls[id] = +id === cur ? (st[id] === "w" ? "w" : "a") : st[id] || "";
      return [{
        t: "tree",
        label: "二叉搜索树与允许范围 (lo, hi)",
        nodes: snapNodes(),
        root: 0,
        cls,
        directed: true,
        on: stack.slice(),
        onEdges: stackEdges(),
        ptrs: { node: cur >= 0 ? cur : null },
        badges: { ...rng },
      }];
    };
    snap("开始", "每个节点下方会标出它允许的范围 (lo, hi)。根节点从 (−∞, +∞) 开始，没有限制。", view(-1), {
      at: "start",
      facts: [["当前 node", "—"], ["下界 lo", "−∞"], ["上界 hi", "+∞"]],
    });
    const check = (id, lo, hi, why, prevLo, prevHi) => {
      const nd = N[id];
      stack.push(id);
      rng[id] = `(${f(lo)}, ${f(hi)})`;
      const ok = lo < nd.v && nd.v < hi;
      st[id] = ok ? "c" : "w";
      const loFact = prevLo !== undefined && prevLo !== lo ? ["下界 lo", f(lo), f(prevLo)] : ["下界 lo", f(lo)];
      const hiFact = prevHi !== undefined && prevHi !== hi ? ["上界 hi", f(hi), f(prevHi)] : ["上界 hi", f(hi)];
      snap(
        ok ? "在范围内" : "超出范围",
        `<b>${nd.v}</b>${why}，允许的范围是 (${f(lo)}, ${f(hi)})。` + (ok ? `${nd.v} 在范围内，接着带着收紧的范围去检查左右子树。` : `<b>${nd.v} 不在范围内</b>，这不是二叉搜索树。`),
        view(id),
        ok
          ? { at: ["range", "down"], facts: [["当前 node", nd.v], loFact, hiFact] }
          : { at: ["range", "bad"], kind: "warn", facts: [["当前 node", nd.v], loFact, hiFact, ["判定", "越界"]] },
      );
      if (!ok) {
        stack.pop();
        return false;
      }
      if (nd.l !== null && !check(nd.l, lo, nd.v, ` 在 ${nd.v} 的左边，上界收紧成 ${nd.v}`, lo, hi)) {
        stack.pop();
        return false;
      }
      if (nd.r !== null && !check(nd.r, nd.v, hi, ` 在 ${nd.v} 的右边，下界收紧成 ${nd.v}`, lo, hi)) {
        stack.pop();
        return false;
      }
      stack.pop();
      return true;
    };
    const ans = check(0, -Infinity, Infinity, " 是根节点");
    snap("完成", ans ? "所有节点都在各自的范围内，是合法的二叉搜索树。" : "有节点超出了祖先给它的范围，返回 false。", view(-1), {
      at: "start",
      kind: ans ? "ok" : "warn",
      ans,
      facts: [["结果", ans ? "true" : "false"]],
    });
  },
  alts: [{
    t: "中序要严格递增",
    code: "inorder",
    note: "和「另一种写法」一样：二叉搜索树的中序遍历一定严格递增。按中序走一遍，每个节点都和前一个比，一旦不比前一个大就不是。",
    legend: [["a", "中序刚轮到的节点"], ["c", "比前一个大"], ["w", "不比前一个大"]],
    build(a, snap) {
      const N = {};
      a.t.forEach((v, i) => {
        if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null };
      });
      const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
      if (!N[0]) {
        snap("完成", "空树的中序序列为空，是合法的二叉搜索树。", [{ t: "note", label: "二叉树", html: "空" }], { at: "done", kind: "ok", ans: true, facts: [["结果", "true"]] });
        return;
      }
      const seq = [], st = {}, order = {}, stack = [];
      let prev = -Infinity, bad = false;
      const f = (x) => (x === -Infinity ? "−∞" : x);
      const stackEdges = () => {
        const e = [];
        for (let i = 0; i + 1 < stack.length; i++) e.push([stack[i], stack[i + 1]]);
        return e;
      };
      const view = (cur, opts = {}) => {
        const cls = {};
        for (const id in N) cls[id] = +id === cur && st[id] !== "w" ? "a" : st[id] || "";
        return [
          {
            t: "tree",
            label: "中序遍历（左 → 自己 → 右）",
            nodes: snapNodes(),
            root: 0,
            cls,
            directed: true,
            lrLabels: true,
            on: stack.slice(),
            onEdges: stackEdges(),
            ptrs: { node: cur >= 0 ? cur : null },
            badges: { ...order },
          },
          {
            t: "chips",
            label: "中序序列（必须严格递增）",
            items: seq.map((v, i) => ({ v, cls: bad && i === seq.length - 1 ? "w" : i === seq.length - 1 && opts.justAdded ? "a" : "c" })),
            empty: "还没有",
          },
        ];
      };
      snap("开始", "按中序（左 → 自己 → 右）走一遍，每个节点都和前一个比较。prev 一开始是 −∞。", view(-1), {
        at: "init",
        facts: [["当前 node", "—"], ["prev", "−∞"]],
      });
      const inorder = (id) => {
        if (id === null || bad) return;
        const nd = N[id];
        stack.push(id);
        inorder(nd.l);
        if (bad) {
          stack.pop();
          return;
        }
        seq.push(nd.v);
        order[id] = "第 " + seq.length;
        if (nd.v <= prev) {
          st[id] = "w";
          bad = true;
          snap("不是递增", `中序轮到 <b>${nd.v}</b>，前一个是 ${prev}，${nd.v} 不比它大。中序不是严格递增，返回 false。`, view(id, { justAdded: true }), {
            at: "bad",
            kind: "warn",
            facts: [["当前 node", nd.v], ["prev", f(prev)], ["判定", `${nd.v} ≤ ${f(prev)}`]],
          });
          stack.pop();
          return;
        }
        const old = prev;
        prev = nd.v;
        st[id] = "c";
        snap("比前一个大", `中序轮到 <b>${nd.v}</b>，比前一个 ${f(old)} 大。prev 更新成 ${nd.v}。`, view(id, { justAdded: true }), {
          at: "ok",
          facts: [["当前 node", nd.v], ["prev", prev, f(old)]],
        });
        inorder(nd.r);
        stack.pop();
      };
      inorder(0);
      snap("完成", bad ? "中序序列不是严格递增的，不是二叉搜索树。" : `中序序列 [${seq.join(", ")}] 严格递增，是合法的二叉搜索树。`, view(-1), {
        at: "done",
        kind: bad ? "warn" : "ok",
        ans: !bad,
        facts: [["prev", f(prev)], ["结果", bad ? "false" : "true"]],
      });
    },
  }],
  points: [
    { t: "严格大于、严格小于", body: "二叉搜索树里不能有相等的值，所以范围是开区间，用 <code>&lt;</code> 而不是 <code>&lt;=</code>。" },
    { t: "初始范围用无穷", body: "节点值可以取到 32 位整数的最大最小值，所以上下界要用 <code>float('inf')</code>，不能用某个具体的大数。" },
    { t: "复杂度", body: "每个节点检查一次，时间 O(n)。" },
  ],
};
