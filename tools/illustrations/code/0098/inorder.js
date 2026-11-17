var isValidBST = function(root) {
    let prev = -Infinity;                       //@init
    const inorder = (node) => {
        if (!node) {
            return true;
        }
        if (!inorder(node.left)) {
            return false;
        }
        if (node.val <= prev) {                 // 必须比前一个大 //@bad
            return false;                       //@bad
        }
        prev = node.val;                        //@ok
        return inorder(node.right);
    };
    return inorder(root);                       //@done
};
