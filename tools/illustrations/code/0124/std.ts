function maxPathSum(root: TreeNode | null): number {
    let best = -Infinity;                           //@init
    // 从 node 往下一条链的最大和
    const gain = (node: TreeNode | null): number => {
        if (!node) return 0;
        const l = Math.max(gain(node.left), 0);     // 负的就不要了 //@node
        const r = Math.max(gain(node.right), 0);    //@node
        best = Math.max(best, node.val + l + r);    // 以 node 为最高点的路径 //@node
        return node.val + Math.max(l, r);           // 往上只能带一条链 //@node
    };
    gain(root);                                     //@init
    return best;                                    //@done
}
