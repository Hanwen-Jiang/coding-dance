function inorderTraversal(root: TreeNode | null): number[] {
    const res: number[] = [];                   //@init
    const dfs = (node: TreeNode | null): void => {
        if (!node) {                            //@enter
            return;
        }
        dfs(node.left);                         // 左 //@enter
        res.push(node.val);                     // 自己 //@visit
        dfs(node.right);                        // 右 //@visit
    };
    dfs(root);                                  //@init
    return res;                                 //@done
}
