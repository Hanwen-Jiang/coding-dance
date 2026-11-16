function rightSideView(root: TreeNode | null): number[] {
    const res: number[] = [];                       //@init
    let q: TreeNode[] = root ? [root] : [];         //@init
    while (q.length) {                              //@level
        res.push(q[q.length - 1].val);              // 这一层最右边的节点 //@level
        const next: TreeNode[] = [];                //@level
        for (const node of q) {                     //@level
            if (node.left) next.push(node.left);    //@level
            if (node.right) next.push(node.right);  //@level
        }
        q = next;                                   //@level
    }
    return res;                                     //@done
}
