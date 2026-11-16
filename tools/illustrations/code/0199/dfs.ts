function rightSideView(root: TreeNode | null): number[] {
    const res: number[] = [];                       //@init
    const dfs = (node: TreeNode | null, depth: number): void => {
        if (!node) return;
        if (depth === res.length) {                 // 这一层第一次到 //@first,pass
            res.push(node.val);                     //@first
        }
        dfs(node.right, depth + 1);                 // 先右
        dfs(node.left, depth + 1);                  // 后左
    };
    dfs(root, 0);                                   //@init
    return res;                                     //@done
}
