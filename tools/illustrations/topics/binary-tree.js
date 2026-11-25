module.exports = {
  slug: "binary-tree", name: "二叉树", kind: "ds", order: 6,
  lede: "每个节点最多两个孩子。树的题几乎都是两种走法：递归地往下走（深度优先，前中后序），或者用队列一层层走（广度优先，层序）。先把这四种遍历写熟，再看力扣怎么用一个数组表示一棵树。",
  related: [94, 104, 226, 101, 543, 102, 108, 98, 230, 199, 114, 105, 437, 236, 124],
  sections: [{
    key: "build", t: "定义和构造：从层序数组建树",
    body: [
      "力扣用层序数组表示一棵树：<code>[1,2,3,null,4]</code> 是按层从左到右写出每个节点，<code>null</code> 表示这个位置没有节点，<b>空节点的孩子不再写出来</b>。所以它不是「下标 i 的孩子在 2i+1」那种满二叉树的写法。",
      "按同样的顺序建回来：用一个队列存「还没接孩子的节点」，每次取出一个，依次读两个值当它的左、右孩子，新建出来的孩子也排进队尾。这正是层序遍历的倒过来。",
      "下面的函数读的是逗号分隔的字符串（比如 <code>\"1,2,3,null,4\"</code>），本地调试时很好用。",
    ],
    points: [
      { t: "null 不进队", body: "空位置不建节点、也不进队列，所以它的「孩子」不会占用后面的值。" },
      { t: "读到末尾就停", body: "末尾的 <code>null</code> 力扣会省略，值读完了，剩下的节点都没有孩子。" },
    ],
    codes: [{ t: "用队列按层建树", key: "build", code: `
# 力扣已经定义好了 TreeNode：
# class TreeNode:
#     def __init__(self, val=0, left=None, right=None):
#         self.val = val
#         self.left = left
#         self.right = right

class Solution:
    def buildTree(self, data: str) -> Optional[TreeNode]:
        vals = data.split(",") if data else []      # "1,2,null" -> ["1", "2", "null"] #@init
        if not vals or vals[0] == "null":           #@init
            return None                             #@init
        root = TreeNode(int(vals[0]))               #@root
        q = deque([root])                           # 还没接孩子的节点 #@root
        i = 1
        while q and i < len(vals):                  #@take
            node = q.popleft()                      # 给它接左、右孩子 #@take
            if vals[i] != "null":                   #@left
                node.left = TreeNode(int(vals[i]))  #@left
                q.append(node.left)                 #@left
            i += 1                                  #@left
            if i < len(vals) and vals[i] != "null": #@right
                node.right = TreeNode(int(vals[i])) #@right
                q.append(node.right)                #@right
            i += 1                                  #@right
        return root                                 #@done
` }],
    sig: { fn: "buildTree", params: ["string"], ret: "TreeNode" },
    call: (a) => [a.data],
    cases: [[""], ["7"], ["1,null,2,3"], ["5,4,8,11,null,13,4,7,2,null,null,null,1"]],
    gen: (R) => { const t = R.tree(R.int(1, 9), () => R.int(1, 9)); const data = t.lc.map((x) => (x === null ? "null" : x)).join(","); return { args: { data }, note: `data = "${data}"` }; },
    demo: {
      legend: [["a", "正在接孩子的节点"], ["e", "在队列里"], ["c", "刚接上的孩子"]],
      presets: [{ label: "示例", args: { data: "1,2,3,null,4,5,6,7" }, note: 'data = "1,2,3,null,4,5,6,7"', expect: [1, 2, 3, null, 4, 5, 6, 7] }],
      build(a, snap) {
        const vals = a.data ? a.data.split(",") : [], N = {}, q = [];
        const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
        let i = 1, cur = -1, fresh = [];
        const view = (opts = {}) => {
          const cls = {};
          for (const id in N) cls[id] = +id === cur ? "a" : fresh.includes(+id) ? "c" : q.includes(+id) ? "e" : "";
          return [
            {
              t: "array",
              label: "vals",
              items: vals.map((v, k) => ({ v, cls: k === opts.atVal ? "a" : k < i ? "d" : "" })),
              ptrs: { i: i < vals.length ? i : null },
            },
            Object.keys(N).length
              ? {
                  t: "tree",
                  label: "树（带 L/R 方向）",
                  nodes: snapNodes(),
                  root: 0,
                  cls,
                  directed: true,
                  lrLabels: true,
                  ptrs: { ...(cur >= 0 ? { node: cur } : {}), ...(fresh.length ? { new: fresh[0] } : {}) },
                  ...(opts.prevNodes ? { prevNodes: opts.prevNodes } : {}),
                  ...(opts.onEdges ? { onEdges: opts.onEdges } : {}),
                  ...(opts.animEdges ? { animEdges: opts.animEdges } : {}),
                }
              : { t: "note", label: "树", html: "空" },
            {
              t: "chips",
              label: "队列（左边先出）",
              items: q.map((id) => ({ v: N[id].v, cls: fresh.includes(id) ? "c" : "e" })),
              empty: "空",
            },
          ];
        };
        if (!vals.length || vals[0] === "null") {
          i = vals.length;
          snap("空树", "没有值，返回空。", view(), { at: "init", kind: "ok", ans: [], facts: [["已建节点", 0], ["队列长度", 0]] });
          return;
        }
        i = 0;
        snap("切分", `按逗号切开，一共 ${vals.length} 个值。`, view({ atVal: 0 }), {
          at: "init",
          facts: [["下标 i", 0], ["队列长度", 0], ["已建节点", 0]],
        });
        const prevRootSnap = snapNodes();
        N[0] = { v: Number(vals[0]), l: null, r: null }; q.push(0); i = 1; fresh = [0];
        snap("根节点", `第一个值 ${vals[0]} 是根，放进队列。`, view({ prevNodes: prevRootSnap }), {
          at: "root",
          facts: [["下标 i", 1, 0], ["队列长度", 1, 0], ["已建节点", 1, 0]],
        });
        let prevCurLabel = "—";
        while (q.length && i < vals.length) {
          const oldQLen = q.length;
          cur = q.shift(); fresh = [];
          const curLabel = String(N[cur].v);
          snap("取出节点", `取出 ${N[cur].v}，接下来的两个值是它的左、右孩子。`, view(), {
            at: "take",
            facts: [
              ["当前节点", curLabel, prevCurLabel],
              ["下标 i", i],
              ["队列长度", q.length, oldQLen],
              ["已建节点", Object.keys(N).length],
            ],
          });
          prevCurLabel = curLabel;
          const add = (side, tag) => {
            if (i >= vals.length) return;
            const oldI = i, oldCnt = Object.keys(N).length, oldQ = q.length;
            const v = vals[i];
            let prevSnap = null, edge = null;
            if (v !== "null") {
              prevSnap = snapNodes();
              N[i] = { v: Number(v), l: null, r: null };
              N[cur][side] = i;
              q.push(i);
              fresh = [i];
              edge = [cur, i];
            } else {
              fresh = [];
            }
            i++;
            const newCnt = Object.keys(N).length;
            snap(
              side === "l" ? "左孩子" : "右孩子",
              v === "null"
                ? `下一个值是 null：${N[cur].v} 没有${side === "l" ? "左" : "右"}孩子。`
                : `${v} 接成 ${N[cur].v} 的${side === "l" ? "左" : "右"}孩子，放进队尾。`,
              view({
                atVal: oldI,
                ...(prevSnap ? { prevNodes: prevSnap } : {}),
                ...(edge ? { onEdges: [edge], animEdges: [edge] } : {}),
              }),
              {
                at: tag,
                facts: [
                  ["当前节点", curLabel],
                  ["下标 i", i, oldI],
                  q.length !== oldQ ? ["队列长度", q.length, oldQ] : ["队列长度", q.length],
                  newCnt !== oldCnt ? ["已建节点", newCnt, oldCnt] : ["已建节点", newCnt],
                ],
              },
            );
          };
          add("l", "left");
          add("r", "right");
        }
        cur = -1; fresh = [];
        const out = [], bq = [0];
        while (bq.length) { const id = bq.shift(); if (id === null) { out.push(null); continue; } out.push(N[id].v); bq.push(N[id].l, N[id].r); }
        while (out.length && out[out.length - 1] === null) out.pop();
        snap("完成", "值都读完了，返回根节点。", view(), {
          at: "done",
          kind: "ok",
          ans: out,
          facts: [["当前节点", "完成", prevCurLabel], ["已建节点", Object.keys(N).length]],
        });
      },
    },
  }, {
    key: "orders", t: "前序、中序、后序（递归）",
    body: [
      "递归遍历只有一个模板：先处理左子树，再处理右子树。<b>访问节点自己的时机</b>不同，就分出三种顺序：进入节点时访问是<b>前序</b>（根 左 右），左子树走完再访问是<b>中序</b>（左 根 右），两棵子树都走完再访问是<b>后序</b>（左 右 根）。",
      "下面的代码一趟递归同时记下三种顺序，看演示时注意每个节点在三个列表里出现的时机。二叉搜索树的中序遍历是从小到大的；要先算出子树的信息再算自己（比如树的高度、直径）就是后序。",
    ],
    points: [
      { t: "递归的出口", body: "节点为空时直接返回。所有树的递归都从这一句开始。" },
      { t: "递归深度", body: "递归用的是系统栈，树退化成一条链时深度就是 n。Python 默认只有约 1000 层，深树要改成迭代写法。" },
    ],
    codes: [{ t: "一趟递归记三种顺序", key: "orders", code: `
class Solution:
    def traversals(self, root: Optional[TreeNode]) -> List[List[int]]:
        pre, ino, post = [], [], []
        def dfs(node):
            if not node:                    #@base
                return                      #@base
            pre.append(node.val)            # 前序：刚进入这个节点 #@pre
            dfs(node.left)                  #@left
            ino.append(node.val)            # 中序：左子树走完了 #@in
            dfs(node.right)                 #@right
            post.append(node.val)           # 后序：两棵子树都走完了 #@post
        dfs(root)                           #@start
        return [pre, ino, post]             #@done
` }],
    sig: { fn: "traversals", params: ["TreeNode"], ret: "List<List<int>>" },
    call: (a, H) => [H.toLc(a.t)],
    cases: [[[]], [[1]], [[1, null, 2, 3]]],
    gen: (R) => { const t = R.tree(R.int(1, 8), () => R.int(1, 9)); return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}` }; },
    demo: {
      legend: [["a", "当前节点"], ["e", "在递归栈上"], ["c", "已经返回"]],
      presets: [{ label: "示例", args: { t: [1, 2, 3, 4, 5, null, 6] }, note: "root = [1,2,3,4,5,null,6]", expect: [[1, 2, 4, 5, 3, 6], [4, 2, 5, 1, 3, 6], [4, 5, 2, 6, 3, 1]] }],
      build(a, snap) {
        const N = {};
        a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
        const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
        const pre = [], ino = [], post = [], path = [], done = new Set();
        const pathEdges = () => {
          const e = [];
          for (let k = 0; k + 1 < path.length; k++) e.push([path[k], path[k + 1]]);
          return e;
        };
        const view = (cur, opts = {}) => {
          const cls = {};
          for (const id in N) cls[id] = +id === cur ? "a" : path.includes(+id) ? "e" : done.has(+id) ? "c" : "";
          return [
            N[0]
              ? {
                  t: "tree",
                  label: "二叉树（带 L/R 方向）",
                  nodes: snapNodes(),
                  root: 0,
                  cls,
                  directed: true,
                  lrLabels: true,
                  on: path.slice(),
                  onEdges: pathEdges().concat(opts.onEdges || []),
                  ...(opts.animEdges && opts.animEdges.length ? { animEdges: opts.animEdges } : {}),
                  ptrs: { node: cur >= 0 ? cur : null },
                }
              : { t: "note", html: "空树" },
            { t: "chips", label: "前序 pre", items: pre.map((v, i) => ({ v, cls: opts.just === "pre" && i === pre.length - 1 ? "a" : "c" })), empty: "空" },
            { t: "chips", label: "中序 ino", items: ino.map((v, i) => ({ v, cls: opts.just === "ino" && i === ino.length - 1 ? "a" : "c" })), empty: "空" },
            { t: "chips", label: "后序 post", items: post.map((v, i) => ({ v, cls: opts.just === "post" && i === post.length - 1 ? "a" : "c" })), empty: "空" },
          ];
        };
        let prevNode = "—";
        snap("开始", "从根节点开始递归。", view(-1), {
          at: "start",
          facts: [["当前节点", "—"], ["栈深", 0], ["pre / ino / post", "0 / 0 / 0"]],
        });
        const dfs = (id, par) => {
          if (id === null || !N[id]) return;
          const v = N[id].v, sv = String(v);
          const oldD = path.length, oldPre = pre.length;
          path.push(id); pre.push(v);
          snap("前序", `进入 ${v}，先把它记进前序。接着递归左子树${N[id].l === null ? "（没有，马上返回）" : ""}。`, view(id, {
            just: "pre",
            ...(par !== null ? { animEdges: [[par, id]] } : {}),
          }), {
            at: ["pre", "left"],
            facts: [
              ["当前节点", sv, prevNode],
              ["栈深", path.length, oldD],
              ["前序 pre", pre.length, oldPre],
              ["中序 / 后序", `${ino.length} / ${post.length}`],
            ],
          });
          prevNode = sv;
          dfs(N[id].l, id);
          const oldIno = ino.length;
          ino.push(v);
          snap("中序", `${v} 的左子树走完了，把 ${v} 记进中序。接着递归右子树${N[id].r === null ? "（没有，马上返回）" : ""}。`, view(id, {
            just: "ino",
            ...(N[id].r !== null ? { onEdges: [[id, N[id].r]] } : {}),
          }), {
            at: ["in", "right"],
            facts: [
              ["当前节点", sv, prevNode],
              ["栈深", path.length],
              ["中序 ino", ino.length, oldIno],
              ["前序 / 后序", `${pre.length} / ${post.length}`],
            ],
          });
          prevNode = sv;
          dfs(N[id].r, id);
          const oldPost = post.length, oldDepth2 = path.length;
          post.push(v); path.pop(); done.add(id);
          snap("后序", `${v} 的两棵子树都走完了，把 ${v} 记进后序，返回上一层。`, view(id, { just: "post" }), {
            at: "post",
            facts: [
              ["当前节点", sv, prevNode],
              ["栈深", path.length, oldDepth2],
              ["后序 post", post.length, oldPost],
              ["前序 / 中序", `${pre.length} / ${ino.length}`],
            ],
          });
          prevNode = sv;
        };
        if (!N[0]) {
          snap("空树", "根是空的，递归马上返回。", view(-1), { at: "base", facts: [["当前节点", "空"], ["栈深", 0]] });
        }
        dfs(0, null);
        snap("完成", "同一个节点：进入时记前序，左边回来记中序，右边回来记后序。", view(-1), {
          at: "done",
          kind: "ok",
          ans: [pre, ino, post],
          facts: [["前序 / 中序 / 后序", `${pre.length} / ${ino.length} / ${post.length}`]],
        });
      },
    },
  }, {
    key: "inorder-iter", t: "中序遍历（迭代）",
    body: [
      "递归能写的，用一个显式的栈也能写。中序遍历的迭代写法：从当前节点<b>一路往左走</b>，沿途的节点都压栈；走到头了，弹出栈顶访问它，再转到它的<b>右子树</b>重复同样的过程。",
      "栈里存的是「左边还没走完、自己还没访问」的节点，和递归时系统栈里的东西一样。树很深时用这种写法不会栈溢出。",
    ],
    points: [
      { t: "循环条件", body: "<code>cur or stack</code>：当前还有节点要往左走，或者栈里还有节点没访问，都要继续。" },
      { t: "前序、后序也能迭代", body: "前序是压栈时就访问；后序可以按「根 右 左」的前序走一遍，再把结果反过来。" },
    ],
    codes: [{ t: "用栈模拟递归", key: "inorder-iter", code: `
class Solution:
    def inorderTraversal(self, root: Optional[TreeNode]) -> List[int]:
        res, stack, cur = [], [], root      #@init
        while cur or stack:                 #@loop
            while cur:                      # 一路往左走，沿途的节点压栈 #@push
                stack.append(cur)           #@push
                cur = cur.left              #@push
            cur = stack.pop()               # 左边到头了，弹出来访问 #@pop
            res.append(cur.val)             #@pop
            cur = cur.right                 # 再去它的右子树 #@right
        return res                          #@done
` }],
    sig: { fn: "inorderTraversal", params: ["TreeNode"], ret: "List<int>" },
    call: (a, H) => [H.toLc(a.t)],
    cases: [[[]], [[1]], [[1, null, 2, 3]]],
    gen: (R) => { const t = R.tree(R.int(1, 8), () => R.int(1, 9)); return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}` }; },
    demo: {
      legend: [["a", "cur"], ["e", "在栈里"], ["c", "已经访问"]],
      presets: [{ label: "示例", args: { t: [4, 2, 6, 1, 3, 5, 7] }, note: "root = [4,2,6,1,3,5,7]", expect: [1, 2, 3, 4, 5, 6, 7] }],
      build(a, snap) {
        const N = {};
        a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
        const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
        const res = [], st = [], seen = new Set(), order = {};
        let cur = N[0] ? 0 : null;
        const view = (opts = {}) => {
          const cls = {};
          for (const id in N) cls[id] = +id === cur ? "a" : st.includes(+id) ? "e" : seen.has(+id) ? "c" : "";
          return [
            N[0]
              ? {
                  t: "tree",
                  label: "用栈模拟中序遍历",
                  nodes: snapNodes(),
                  root: 0,
                  cls,
                  directed: true,
                  lrLabels: true,
                  ptrs: { cur: cur !== null ? cur : null },
                  badges: { ...order },
                  ...(opts.onEdges && opts.onEdges.length ? { onEdges: opts.onEdges } : {}),
                  ...(opts.animEdges && opts.animEdges.length ? { animEdges: opts.animEdges } : {}),
                }
              : { t: "note", html: "空树" },
            {
              t: "chips",
              label: "栈（右边是栈顶）",
              items: st.map((id, i) => ({ v: N[id].v, cls: opts.pushedCount && i >= st.length - opts.pushedCount ? "a" : "e" })),
              empty: "空",
            },
            {
              t: "chips",
              label: "res",
              items: res.map((v, i) => ({ v, cls: opts.justPopped && i === res.length - 1 ? "a" : "c" })),
              empty: "空",
            },
          ];
        };
        let prevCurStr = cur !== null ? String(N[cur].v) : "空";
        snap("开始", "cur 指着根，栈是空的。", view(), {
          at: "init",
          facts: [["当前 cur", prevCurStr], ["栈长度", 0], ["已访问", 0]],
        });
        while (cur !== null || st.length) {
          if (cur !== null) {
            const went = [], wentEdges = [], oldLen = st.length;
            while (cur !== null) {
              st.push(cur);
              went.push(N[cur].v);
              if (N[cur].l !== null) wentEdges.push([cur, N[cur].l]);
              cur = N[cur].l;
            }
            const curStr = "空";
            snap("一路往左", `从 ${went[0]} 往左走到头，沿途的 ${went.join("、")} 依次压栈。`, view({ pushedCount: went.length, onEdges: wentEdges, animEdges: wentEdges }), {
              at: ["loop", "push"],
              facts: [["当前 cur", curStr, prevCurStr], ["栈长度", st.length, oldLen], ["栈顶", N[st[st.length - 1]].v], ["已访问", res.length]],
            });
            prevCurStr = curStr;
          }
          const oldLen = st.length, oldRes = res.length;
          cur = st.pop(); res.push(N[cur].v); seen.add(cur);
          order[cur] = "第 " + res.length;
          const curStr = String(N[cur].v);
          snap("弹出访问", `左边到头了。弹出栈顶 ${N[cur].v}，记进结果。`, view({ justPopped: true }), {
            at: "pop",
            facts: [
              ["弹出 cur", curStr, prevCurStr],
              ["栈长度", st.length, oldLen],
              ["栈顶", st.length ? N[st[st.length - 1]].v : "空"],
              ["已访问", res.length, oldRes],
            ],
          });
          prevCurStr = curStr;
          const r = N[cur].r, rStr = r !== null ? String(N[r].v) : "空";
          const rightEdge = r !== null ? [[cur, r]] : [];
          snap("转向右子树", r === null ? `${N[cur].v} 没有右子树，下一轮直接从栈里弹。` : `转到 ${N[cur].v} 的右孩子 ${N[r].v}，对它重复「一路往左」。`, view({ onEdges: rightEdge, animEdges: rightEdge }), {
            at: "right",
            facts: [["下一 cur", rStr, prevCurStr], ["栈长度", st.length], ["已访问", res.length]],
          });
          cur = r;
          prevCurStr = rStr;
        }
        snap("完成", "cur 是空，栈也空了。", view(), {
          at: ["loop", "done"],
          kind: "ok",
          ans: res,
          facts: [["当前 cur", "空"], ["栈长度", 0], ["已访问", res.length]],
        });
      },
    },
  }, {
    key: "level", t: "层序遍历（BFS）",
    body: [
      "层序遍历用队列：先放根，每轮把<b>这一层</b>的节点全部出队，同时把它们的孩子放到队尾。关键是每层开始前记下队列长度 n，只出队 n 次，这样就知道一层在哪里结束。",
      "有了「一层」的概念，每层的最大值、平均值、最右边的节点（199）、锯齿形遍历都是在这个模板上改一两行。",
    ],
    points: [
      { t: "初值取这一层的第一个", body: "求最大值时用这一层第一个节点的值做初值，不用担心节点值是很小的负数。" },
      { t: "用 deque", body: "Python 列表的 <code>pop(0)</code> 是 O(n)，<code>deque.popleft()</code> 是 O(1)。" },
    ],
    codes: [{ t: "按层处理", key: "level", code: `
class Solution:
    def largestValues(self, root: Optional[TreeNode]) -> List[int]:
        res = []
        q = deque([root]) if root else deque()  #@init
        while q:
            best = q[0].val                     #@level
            for _ in range(len(q)):             # 这一层有 len(q) 个节点 #@level
                node = q.popleft()              #@pop
                best = max(best, node.val)      #@pop
                if node.left:                   #@push
                    q.append(node.left)         #@push
                if node.right:                  #@push
                    q.append(node.right)        #@push
            res.append(best)                    #@end
        return res                              #@done
` }],
    sig: { fn: "largestValues", params: ["TreeNode"], ret: "List<int>" },
    call: (a, H) => [H.toLc(a.t)],
    cases: [[[]], [[1, 2, 3]], [[-5, -9, -2]], [[1, 3, 2, 5, 3, null, 9]]],
    gen: (R) => { const t = R.tree(R.int(1, 9), () => R.int(-9, 20)); return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}` }; },
    demo: {
      legend: [["a", "刚出队的节点"], ["e", "在队列里"], ["c", "已经处理完"]],
      presets: [{ label: "示例 1", args: { t: [1, 3, 2, 5, 3, null, 9] }, note: "root = [1,3,2,5,3,null,9]", expect: [1, 3, 9] }],
      build(a, snap) {
        const N = {};
        a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
        const snapNodes = () => Object.fromEntries(Object.entries(N).map(([k, v]) => [k, { ...v }]));
        const q = N[0] ? [0] : [], res = [], done = new Set(), layerOf = N[0] ? { 0: "第 1 层" } : {};
        const view = (cur, opts = {}) => {
          const cls = {};
          for (const id in N) cls[id] = +id === cur ? "a" : q.includes(+id) ? "e" : done.has(+id) ? "c" : "";
          return [
            N[0]
              ? {
                  t: "tree",
                  label: "二叉树层序遍历（BFS 按层推进）",
                  nodes: snapNodes(),
                  root: 0,
                  cls,
                  directed: true,
                  lrLabels: true,
                  ptrs: { node: cur >= 0 ? cur : null },
                  badges: { ...layerOf },
                  ...(opts.onEdges && opts.onEdges.length ? { onEdges: opts.onEdges } : {}),
                  ...(opts.animEdges && opts.animEdges.length ? { animEdges: opts.animEdges } : {}),
                }
              : { t: "note", html: "空树" },
            {
              t: "chips",
              label: "队列（左边先出）",
              items: q.map((id) => ({ v: N[id].v, cls: opts.pushed && opts.pushed.includes(id) ? "a" : "e" })),
              empty: "空",
            },
            {
              t: "chips",
              label: "每层的最大值",
              items: res.map((v, i) => ({ v, cls: opts.newLayer && i === res.length - 1 ? "a" : "c" })),
              empty: "还没有",
            },
          ];
        };
        snap("开始", N[0] ? "根节点放进队列。" : "空树，队列是空的。", view(-1), {
          at: "init",
          facts: [["当前层", "—"], ["队列长度", q.length]],
        });
        while (q.length) {
          const n = q.length, layerNo = res.length + 1;
          let best = N[q[0]].v;
          snap(`第 ${layerNo} 层`, `队列里的 ${n} 个节点就是这一层。best 先取第一个的值 ${best}。`, view(-1), {
            at: "level",
            facts: [["当前层", `第 ${layerNo} 层`], ["这一层节点数", n], ["best", best], ["队列长度", q.length]],
          });
          for (let k = 0; k < n; k++) {
            const oldQLen = q.length, prevBest = best;
            const id = q.shift(), nd = N[id], kids = [nd.l, nd.r].filter((c) => c !== null);
            best = Math.max(best, nd.v);
            kids.forEach((c) => {
              q.push(c);
              layerOf[c] = `第 ${layerNo + 1} 层`;
            });
            done.add(id);
            const edges = kids.map((c) => [id, c]);
            snap("出队", `取出 ${nd.v}，best = ${best}。` + (kids.length ? `孩子 ${kids.map((c) => N[c].v).join("、")} 放到队尾。` : "它没有孩子。"), view(id, { pushed: kids, onEdges: edges, animEdges: edges }), {
              at: kids.length ? ["pop", "push"] : "pop",
              facts: [
                ["当前层", `第 ${layerNo} 层`],
                ["本层进度", `${k + 1} / ${n}`, `${k} / ${n}`],
                best !== prevBest ? ["best", best, prevBest] : ["best", best],
                q.length !== oldQLen ? ["队列长度", q.length, oldQLen] : ["队列长度", q.length],
              ],
            });
          }
          const prevResLen = res.length;
          res.push(best);
          snap("这一层结束", `这一层的最大值是 ${best}。`, view(-1, { newLayer: true }), {
            at: "end",
            facts: [["完成层", `第 ${layerNo} 层`], ["本层最大值", best], ["已记录层数", res.length, prevResLen]],
          });
        }
        snap("完成", `结果是 [${res.join(", ")}]。`, view(-1), {
          at: "done",
          kind: "ok",
          ans: res,
          facts: [["总层数", res.length], ["结果", `[${res.join(", ")}]`]],
        });
      },
    },
  }],
};
