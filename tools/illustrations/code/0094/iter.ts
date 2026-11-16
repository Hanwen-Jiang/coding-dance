function inorderTraversal(root: TreeNode | null): number[] {
    const res: number[] = [], stack: TreeNode[] = [];   //@init
    let cur = root;                             //@init
    while (cur || stack.length) {
        while (cur) {                           // 一路向左，沿途入栈 //@left
            stack.push(cur);                    //@left
            cur = cur.left;                     //@left
        }
        const node = stack.pop() as TreeNode;   //@pop
        res.push(node.val);                     //@pop
        cur = node.right;                       // 转向右子树 //@pop
    }
    return res;                                 //@done
}
