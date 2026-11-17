var hasPathSum = function(root, targetSum) {
    if (!root) {                                    //@base
        return false;                               //@base
    }
    const rest = targetSum - root.val;              // 往下还要凑多少 //@visit
    if (!root.left && !root.right) {                // 叶子：看是不是正好凑够 //@leaf
        return rest === 0;                          //@leaf
    }
    return hasPathSum(root.left, rest) || hasPathSum(root.right, rest);     //@down
};
