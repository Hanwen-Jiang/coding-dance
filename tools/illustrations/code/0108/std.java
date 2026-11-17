class Solution {
    public TreeNode sortedArrayToBST(int[] nums) {
        return build(nums, 0, nums.length - 1);         //@init,done
    }

    private TreeNode build(int[] nums, int lo, int hi) {
        if (lo > hi) {
            return null;
        }
        int mid = (lo + hi) / 2;                        //@node
        TreeNode node = new TreeNode(nums[mid]);        //@node
        node.left = build(nums, lo, mid - 1);           //@sub
        node.right = build(nums, mid + 1, hi);          //@sub
        return node;
    }
}
