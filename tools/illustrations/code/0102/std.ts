function levelOrder(root: TreeNode | null): number[][] {
    const res: number[][] = [];
    if (!root) {
        return res;
    }
    let q: TreeNode[] = [root];             //@init
    while (q.length) {
        const level: number[] = [];         //@level
        const next: TreeNode[] = [];        // 下一层的节点先放这里 //@level
        for (const node of q) {             // 这一层有 q.length 个节点 //@level
            level.push(node.val);           //@pop
            if (node.left) {                //@push
                next.push(node.left);       //@push
            }
            if (node.right) {               //@push
                next.push(node.right);      //@push
            }
        }
        res.push(level);                    //@end
        q = next;                           //@end
    }
    return res;                             //@done
}
