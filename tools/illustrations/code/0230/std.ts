function kthSmallest(root: TreeNode | null, k: number): number {
    const stack: TreeNode[] = [];                   //@init
    let cur = root;                                 //@init
    while (true) {
        while (cur) {                               // 一路向左 //@left
            stack.push(cur);                        //@left
            cur = cur.left;                         //@left
        }
        const node = stack.pop()!;                  //@pop
        k--;                                        //@pop
        if (k === 0) {                              // 中序遍历的第 k 个 //@found
            return node.val;                        //@found
        }
        cur = node.right;                           //@right
    }
}
