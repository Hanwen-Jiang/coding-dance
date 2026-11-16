var inorderTraversal = function(root) {
    const res = [], stack = [];                 //@init
    let cur = root;                             //@init
    while (cur || stack.length) {               //@loop
        while (cur) {                           // 一路往左走，沿途的节点压栈 //@push
            stack.push(cur);                    //@push
            cur = cur.left;                     //@push
        }
        cur = stack.pop();                      // 左边到头了，弹出来访问 //@pop
        res.push(cur.val);                      //@pop
        cur = cur.right;                        // 再去它的右子树 //@right
    }
    return res;                                 //@done
};
