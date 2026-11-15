// 力扣 TypeScript 环境里现成的两个节点类型
class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val?: number, next?: ListNode | null) {
    this.val = val === undefined ? 0 : val;
    this.next = next === undefined ? null : next;
  }
}
class TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
  constructor(val?: number, left?: TreeNode | null, right?: TreeNode | null) {
    this.val = val === undefined ? 0 : val;
    this.left = left === undefined ? null : left;
    this.right = right === undefined ? null : right;
  }
}
const __judge = {
  list(vals: number[]): ListNode | null {
    const d = new ListNode();
    let cur = d;
    for (const v of vals) { cur.next = new ListNode(v); cur = cur.next; }
    return d.next;
  },
  listVals(head: ListNode | null): number[] {
    const out: number[] = [];
    for (let n = 0; head && n < 100000; n++, head = head.next) out.push(head.val);
    return out;
  },
  tree(vals: (number | null)[]): TreeNode | null {
    if (!vals.length || vals[0] === null) return null;
    const root = new TreeNode(vals[0]), q: TreeNode[] = [root];
    for (let i = 1, h = 0; i < vals.length; h++) {
      const node = q[h];
      for (const side of ["left", "right"] as const) {
        if (i >= vals.length) break;
        const v = vals[i++];
        if (v !== null) { const c = new TreeNode(v); node[side] = c; q.push(c); }
      }
    }
    return root;
  },
  treeVals(root: TreeNode | null): (number | null)[] {
    const out: (number | null)[] = [], q: (TreeNode | null)[] = [root];
    for (let h = 0; h < q.length; h++) {
      const n = q[h];
      if (!n) { out.push(null); continue; }
      out.push(n.val); q.push(n.left); q.push(n.right);
    }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  },
  in(t: string, v: any): any {
    if (t === "ListNode") return this.list(v);
    if (t === "TreeNode") return this.tree(v);
    if (t === "ListNode[]") return v.map((x: number[]) => this.list(x));
    return v;
  },
  out(t: string, v: any): any {
    if (t === "ListNode") return this.listVals(v);
    if (t === "TreeNode") return this.treeVals(v);
    return v === undefined ? null : v;
  },
};
