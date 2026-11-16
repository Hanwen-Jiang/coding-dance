function diameterOfBinaryTree(root: TreeNode | null): number {
    let best = 0;                               //@init
    const depth = (node: TreeNode | null): number => {
        if (!node) {
            return 0;
        }
        const l = depth(node.left), r = depth(node.right);  //@calc
        best = Math.max(best, l + r);           // 在这个节点拐弯的最长路径 //@calc
        return Math.max(l, r) + 1;              // 返回给上一层的是深度 //@calc
    };
    depth(root);                                //@init
    return best;                                //@done
}
