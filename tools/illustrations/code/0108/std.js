var sortedArrayToBST = function(nums) {
    const build = (lo, hi) => {
        if (lo > hi) {
            return null;
        }
        const mid = (lo + hi) >> 1;                 //@node
        const node = new TreeNode(nums[mid]);       //@node
        node.left = build(lo, mid - 1);             //@sub
        node.right = build(mid + 1, hi);            //@sub
        return node;
    };
    return build(0, nums.length - 1);               //@init,done
};
