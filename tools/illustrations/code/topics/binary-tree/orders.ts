function traversals(root: TreeNode | null): number[][] {
    const pre: number[] = [], ino: number[] = [], post: number[] = [];
    const dfs = (node: TreeNode | null): void => {
        if (!node) {                            //@base
            return;                             //@base
        }
        pre.push(node.val);                     // 前序：刚进入这个节点 //@pre
        dfs(node.left);                         //@left
        ino.push(node.val);                     // 中序：左子树走完了 //@in
        dfs(node.right);                        //@right
        post.push(node.val);                    // 后序：两棵子树都走完了 //@post
    };
    dfs(root);                                  //@start
    return [pre, ino, post];                    //@done
}
