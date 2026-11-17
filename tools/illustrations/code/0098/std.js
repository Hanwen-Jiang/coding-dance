var isValidBST = function(root) {
    // node 的值必须在开区间 (lo, hi) 里
    const check = (node, lo, hi) => {
        if (!node) {
            return true;
        }
        if (node.val <= lo || node.val >= hi) { //@range
            return false;                       //@bad
        }
        return check(node.left, lo, node.val) && check(node.right, node.val, hi);  //@down
    };
    return check(root, -Infinity, Infinity);    //@start
};
