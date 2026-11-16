// 力扣 JavaScript 环境里现成的两个节点类型
function ListNode(val, next) {
  this.val = val === undefined ? 0 : val;
  this.next = next === undefined ? null : next;
}
function TreeNode(val, left, right) {
  this.val = val === undefined ? 0 : val;
  this.left = left === undefined ? null : left;
  this.right = right === undefined ? null : right;
}
const __judge = {
  // 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
  ctx: { nodes: [], tree: null, made: [] },
  mkNode: null, // 138 的 _Node，用到 RandomList 时由附加的前置代码填上
  reset() { this.ctx = { nodes: [], tree: null, made: [] }; },
  list(vals) {
    const d = new ListNode();
    let cur = d;
    for (const v of vals) { cur.next = new ListNode(v); cur = cur.next; this.ctx.nodes.push(cur); }
    return d.next;
  },
  find(root, v) {
    const st = [root];
    while (st.length) { const n = st.pop(); if (!n) continue; if (n.val === v) return n; st.push(n.left, n.right); }
    return null;
  },
  randomList(data) {
    const made = data.map(([v]) => this.mkNode(v));
    data.forEach(([, r], i) => { made[i].next = made[i + 1] || null; made[i].random = r === null ? null : made[r]; });
    this.ctx.made = made;
    return made.length ? made[0] : null;
  },
  randomVals(head) {
    const idx = new Map(), out = [], old = new Set(this.ctx.made);
    for (let p = head; p && idx.size < 100000; p = p.next) idx.set(p, idx.size);
    for (let p = head; p && out.length < 100000; p = p.next) {
      if (old.has(p)) return "没有复制：返回了原链表的节点";
      out.push([p.val, p.random == null ? null : idx.has(p.random) ? idx.get(p.random) : "?"]);
    }
    return out;
  },
  listVals(head) {
    const out = [];
    for (let n = 0; head && n < 100000; n++, head = head.next) out.push(head.val);
    return out;
  },
  tree(vals) {
    if (!vals.length || vals[0] === null) return null;
    const root = new TreeNode(vals[0]), q = [root];
    for (let i = 1, h = 0; i < vals.length; h++) {
      const node = q[h];
      for (const side of ["left", "right"]) {
        if (i >= vals.length) break;
        const v = vals[i++];
        if (v !== null) { node[side] = new TreeNode(v); q.push(node[side]); }
      }
    }
    return root;
  },
  treeVals(root) {
    const out = [], q = [root];
    for (let h = 0; h < q.length; h++) {
      const n = q[h];
      if (!n) { out.push(null); continue; }
      out.push(n.val); q.push(n.left); q.push(n.right);
    }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  },
  in(t, v) {
    const ns = this.ctx.nodes;
    if (t === "ListNode") return this.list(v);
    if (t === "CycleList") {
      const s = ns.length, h = this.list(v[0]);
      if (v[1] !== null && v[1] >= 0 && v[0].length) ns[s + v[0].length - 1].next = ns[s + v[1]];
      return h;
    }
    if (t === "JoinList") {
      const tail = v[1] !== null && v[1] >= 0 ? ns[v[1]] : null, s = ns.length, h = this.list(v[0]);
      if (!v[0].length) return tail;
      ns[s + v[0].length - 1].next = tail;
      return h;
    }
    if (t === "TreeNode") return (this.ctx.tree = this.tree(v));
    if (t === "TreeRef") return this.find(this.ctx.tree, v);
    if (t === "RandomList") return this.randomList(v);
    if (t === "ListNode[]") return v.map((x) => this.list(x));
    return v;
  },
  out(t, v) {
    if (t === "ListNode") return this.listVals(v);
    if (t === "TreeNode") return this.treeVals(v);
    if (t === "NodeIndex") { if (v == null) return null; const i = this.ctx.nodes.indexOf(v); return i >= 0 ? i : "不是输入里的节点"; }
    if (t === "TreeVal") return v == null ? null : v.val;
    if (t === "RandomList") return this.randomVals(v);
    return v === undefined ? null : v;
  },
};
