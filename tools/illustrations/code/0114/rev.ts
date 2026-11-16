function flatten(root: TreeNode | null): void {
    let prev: TreeNode | null = null;               //@init
    // 按 右 → 左 → 根 的顺序访问，从链表的尾巴往头接
    const dfs = (node: TreeNode | null): void => {
        if (!node) {
            return;
        }
        dfs(node.right);
        dfs(node.left);
        node.right = prev;                          //@link
        node.left = null;                           //@link
        prev = node;                                //@link
    };
    dfs(root);                                      //@init
}
