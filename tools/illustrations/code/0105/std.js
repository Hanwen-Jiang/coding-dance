var buildTree = function(preorder, inorder) {
    const idx = new Map();
    inorder.forEach((v, i) => idx.set(v, i));       // 值 -> 中序下标 //@init
    // 前序 [pl, pr)，中序 [il, ir)
    const build = (pl, pr, il, ir) => {
        if (pl === pr) {
            return null;
        }
        const root = new TreeNode(preorder[pl]);    // 前序第一个是根 //@root
        const k = idx.get(root.val);                //@root
        const leftSize = k - il;                    // 中序里根左边的都是左子树 //@root
        root.left = build(pl + 1, pl + 1 + leftSize, il, k);       //@sub
        root.right = build(pl + 1 + leftSize, pr, k + 1, ir);      //@sub
        return root;
    };
    return build(0, preorder.length, 0, inorder.length);   //@init,done
};
