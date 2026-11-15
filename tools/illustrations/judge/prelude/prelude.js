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
  list(vals) {
    const d = new ListNode();
    let cur = d;
    for (const v of vals) { cur.next = new ListNode(v); cur = cur.next; }
    return d.next;
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
    if (t === "ListNode") return this.list(v);
    if (t === "TreeNode") return this.tree(v);
    if (t === "ListNode[]") return v.map((x) => this.list(x));
    return v;
  },
  out(t, v) {
    if (t === "ListNode") return this.listVals(v);
    if (t === "TreeNode") return this.treeVals(v);
    return v === undefined ? null : v;
  },
};
