var invertTree = function(root) {
    if (!root) {                        //@base
        return null;                    //@base
    }
    [root.left, root.right] = [root.right, root.left];  // 交换左右孩子 //@swap
    invertTree(root.left);              //@rec
    invertTree(root.right);             //@rec
    return root;                        //@done
};
