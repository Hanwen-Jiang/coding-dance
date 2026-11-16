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
        if root is None or root is p or root is q:  #@base
            return root                 # 空，或者就是要找的节点 #@base
        left = self.lowestCommonAncestor(root.left, p, q)   #@rec
        right = self.lowestCommonAncestor(root.right, p, q) #@rec
        if left and right:              #@both,one
            return root                 # p、q 分在两边 #@both
        return left or right            # 哪边有就交哪边 #@one
` }, { t: "简洁写法：四行递归", kind: "elegant", code: `
class Solution:
    def lowestCommonAncestor(self, root, p, q):
        if root in (None, p, q):
            return root
        l, r = (self.lowestCommonAncestor(c, p, q) for c in (root.left, root.right))
        return root if l and r else l or r
` }, { t: "不用递归：记录父节点", key: "parent", note: "先遍历一遍记下每个节点的父节点，再从 p 一路往上把祖先都放进集合，最后从 q 往上走，第一个在集合里的就是答案。", code: `
class Solution:
    def lowestCommonAncestor(self, root, p, q):
        parent = {root: None}           #@init
        stack = [root]                  #@init
        while p not in parent or q not in parent:   #@parent
            node = stack.pop()          #@parent
            for child in (node.left, node.right):   #@parent
                if child:               #@parent
                    parent[child] = node    #@parent
                    stack.append(child)     #@parent
        ancestors = set()               #@up
        while p:                        # p 和它所有的祖先 #@up
            ancestors.add(p)            #@up
            p = parent[p]               #@up
        while q not in ancestors:       # q 往上走，第一个碰到的就是答案 #@climb
            q = parent[q]               #@climb
        return q                        #@done
` }],
  sig: { fn: "lowestCommonAncestor", params: ["TreeNode", "TreeRef", "TreeRef"], ret: "TreeVal" },
  call: (a, H) => [H.toLc(a.t), a.p, a.q],
  cases: [[[1, 2], 1, 2], [[1, 2], 2, 1], [[1, null, 2, null, 3], 3, 1], [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 6, 4], [[3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], 0, 8]],
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
  demoTitle: "最近公共祖先演示",
  method: "后序递归",
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
    snap("开始", `找 ${a.p} 和 ${a.q} 的最近公共祖先。每个节点只问左右子树一句话：你们那边找到 p 或 q 了吗？`, view(-1), { at: [], ...f() });
    const rec = (id) => {
      if (id === null || !N[id]) return null;
      stack.push(id);
      if (isPQ(id)) {
        done.add(id); badges[id] = "交 " + N[id].v; stack.pop();
        snap("碰到目标", `${N[id].v} 就是要找的节点，不用再往下找，直接把自己交上去。`, view(id), { at: "base", ...f() });
        return id;
      }
      snap("进入", `进入 ${N[id].v}，先问左子树，再问右子树。`, view(id), { at: "rec", ...f() });
      const l = rec(N[id].l), r = rec(N[id].r);
      const ret = l !== null && r !== null ? id : l !== null ? l : r;
      badges[id] = ret === null ? "空" : "交 " + N[ret].v; done.add(id); stack.pop();
      const msg = l !== null && r !== null ? `左边交上来 ${N[l].v}，右边交上来 ${N[r].v}，p、q 分在两边，<b>${N[id].v}</b> 就是最近公共祖先，把自己交上去。`
        : ret !== null ? `只有一边找到了 ${N[ret].v}，原样往上交。` : "左右两边都没找到，返回空。";
      snap("返回", `${N[id].v}：${msg}`, view(id), { at: l !== null && r !== null ? "both" : "one", ...f() });
      return ret;
    };
    const res = rec(0);
    snap("完成", `根节点最后交上来的是 <b>${N[res].v}</b>，它就是 ${a.p} 和 ${a.q} 的最近公共祖先。`, view(-1, res), { at: [], kind: "ok", ans: N[res].v, ...f() });
  },
  alts: [{
    t: "记录父节点",
    code: "parent",
    note: "和「不用递归」的写法一样：先遍历记下每个节点的父节点；再从 p 一路往上，把 p 和它的祖先放进集合；最后从 q 往上走，第一个在集合里的节点就是答案。",
    legend: [["e", "在栈里"], ["a", "当前节点"], ["b", "p 或 q"], ["w", "在 ancestors 集合里"], ["k", "答案"]],
    build(a, snap) {
      const N = {}; a.t.forEach((v, i) => { if (v != null) N[i] = { v, l: a.t[2 * i + 1] != null ? 2 * i + 1 : null, r: a.t[2 * i + 2] != null ? 2 * i + 2 : null }; });
      const byVal = (v) => +Object.keys(N).find((id) => N[id].v === v);
      const P = byVal(a.p), Q = byVal(a.q), parent = { 0: null }, badges = {}, anc = new Set(), stack = [0];
      let phase = 1;
      const view = (cur, ans) => {
        const cls = {};
        for (const id in N) { const i = +id; cls[id] = i === ans ? "k" : i === cur ? "a" : i === P || i === Q ? "b" : anc.has(i) ? "w" : phase === 1 && stack.includes(i) ? "e" : ""; }
        return [{ t: "tree", nodes: N, root: 0, cls, badges: { ...badges } }, phase === 1
          ? { t: "chips", label: "栈（右边是栈顶）", items: stack.map((i) => N[i].v), empty: "空" }
          : { t: "chips", label: `ancestors：${a.p} 和它所有的祖先`, items: [...anc].map((i) => N[i].v), empty: "空" }];
      };
      const f = () => ({ facts: [["p", a.p], ["q", a.q]] });
      snap("开始", `第一步：从根出发遍历，记下每个节点的父节点，直到 ${a.p} 和 ${a.q} 的父节点都有了。根的父节点是空。`, view(-1), { at: "init", ...f() });
      while (!(P in parent) || !(Q in parent)) {
        const id = stack.pop(), kids = [];
        for (const c of [N[id].l, N[id].r]) if (c !== null) { parent[c] = id; badges[c] = "父 " + N[id].v; stack.push(c); kids.push(N[c].v); }
        snap("记父节点", `弹出 ${N[id].v}。` + (kids.length ? `它的孩子 ${kids.join("、")} 的父节点记成 ${N[id].v}，放进栈里。` : "它没有孩子。"), view(id), { at: "parent", ...f() });
      }
      phase = 2;
      snap("够了", `${a.p} 和 ${a.q} 的父节点都记下来了，不用再遍历。第二步：从 ${a.p} 一路往上，把它和它的祖先都放进集合。`, view(-1), { at: "up", ...f() });
      for (let x = P; x !== null; x = parent[x]) {
        anc.add(x);
        snap("往上走", `${N[x].v} 放进集合。` + (parent[x] === null ? "它是根，到头了。" : `它的父节点是 ${N[parent[x]].v}。`), view(x), { at: "up", ...f() });
      }
      let y = Q;
      snap("从 q 往上", `第三步：从 ${a.q} 往上走，第一个在集合里的节点就是答案。`, view(y), { at: "climb", ...f() });
      while (!anc.has(y)) {
        const old = y; y = parent[y];
        snap("不在集合里", `${N[old].v} 不在集合里，走到它的父节点 ${N[y].v}。`, view(y), { at: "climb", ...f() });
      }
      snap("完成", `<b>${N[y].v}</b> 在集合里：它是 ${a.q} 往上碰到的第一个 ${a.p} 的祖先（节点自己也算），所以是最近公共祖先。`, view(-1, y), { at: "done", kind: "ok", ans: N[y].v, ...f() });
    },
  }],
  points: [
    { t: "比较的是节点不是值", body: "用 <code>is</code> 比较节点本身。题目保证值不重复，但用节点比较更稳。" },
    { t: "返回值有两种含义", body: "可能是找到的 p 或 q，也可能是已经确定的答案。上层不用区分，原样往上交就行。" },
    { t: "复杂度", body: "每个节点最多访问一次，时间 O(n)；递归深度是树高，最坏 O(n)。" },
  ],
};
