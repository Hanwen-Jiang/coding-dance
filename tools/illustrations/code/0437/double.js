var pathSum = function(root, targetSum) {
    // 从 node 开始往下、和为 t 的路径数
    const down = (node, t) => {
        if (!node) {
            return 0;
        }
        return (node.val === t ? 1 : 0) + down(node.left, t - node.val) + down(node.right, t - node.val);  //@down
    };
    if (!root) {                                    //@empty
        return 0;                                   //@empty
    }
    return down(root, targetSum) + pathSum(root.left, targetSum) + pathSum(root.right, targetSum);   //@start,done
};
