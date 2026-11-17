function sortedArrayToBST(nums: number[]): TreeNode | null {
    const build = (lo: number, hi: number): TreeNode | null => {
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
}
