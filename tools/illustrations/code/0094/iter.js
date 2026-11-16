var inorderTraversal = function(root) {
    const res = [], stack = [];                 //@init
    let cur = root;                             //@init
    while (cur || stack.length) {
        while (cur) {                           // 一路向左，沿途入栈 //@left
            stack.push(cur);                    //@left
            cur = cur.left;                     //@left
        }
        cur = stack.pop();                      //@pop
        res.push(cur.val);                      //@pop
        cur = cur.right;                        // 转向右子树 //@pop
    }
    return res;                                 //@done
};
