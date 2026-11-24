var flatten = function(root) {
    let prev = null;                                //@init
    // 按 右 → 左 → 根 的顺序访问，从链表的尾巴往头接
    const dfs = (node) => {
        if (!node) {
            return;
        }
        dfs(node.right);                            //@goR
        dfs(node.left);                             //@goL
        node.right = prev;                          //@linkR
        node.left = null;                           //@clearL
        prev = node;                                //@setP
    };
    dfs(root);                                      //@init
};
