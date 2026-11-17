function inorderTraversal(root: TreeNode | null): number[] {
    const res: number[] = [], stack: TreeNode[] = [];   //@init
    let cur = root;                             //@init
    while (cur || stack.length) {               //@loop
        while (cur) {                           // 一路往左走，沿途的节点压栈 //@push
            stack.push(cur);                    //@push
            cur = cur.left;                     //@push
        }
        const node = stack.pop()!;              // 左边到头了，弹出来访问 //@pop
        res.push(node.val);                     //@pop
        cur = node.right;                       // 再去它的右子树 //@right
    }
    return res;                                 //@done
}
