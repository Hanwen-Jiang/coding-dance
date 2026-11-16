class Solution {
    public boolean isValidBST(TreeNode root) {
        return check(root, Long.MIN_VALUE, Long.MAX_VALUE);    // 用 long，节点值能取到 int 的边界 //@start
    }

    // node 的值必须在开区间 (lo, hi) 里
    private boolean check(TreeNode node, long lo, long hi) {
        if (node == null) {
            return true;
        }
        if (node.val <= lo || node.val >= hi) {     //@range
            return false;                           //@bad
        }
        return check(node.left, lo, node.val) && check(node.right, node.val, hi);  //@down
    }
}
