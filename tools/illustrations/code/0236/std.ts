function lowestCommonAncestor(root: TreeNode | null, p: TreeNode | null, q: TreeNode | null): TreeNode | null {
    if (!root || root === p || root === q) {        //@base
        return root;                                // 空，或者就是要找的节点 //@base
    }
    const left = lowestCommonAncestor(root.left, p, q);     //@rec
    const right = lowestCommonAncestor(root.right, p, q);   //@rec
    if (left && right) {                            //@both,one
        return root;                                // p、q 分在两边 //@both
    }
    return left || right;                           // 哪边有就交哪边 //@one
}
