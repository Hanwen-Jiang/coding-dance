class Solution {
    public int pathSum(TreeNode root, int targetSum) {
        if (root == null) {                             //@empty
            return 0;                                   //@empty
        }
        return down(root, targetSum) + pathSum(root.left, targetSum) + pathSum(root.right, targetSum);   //@start,done
    }

    // 从 node 开始往下、和为 t 的路径数（t 会越减越小，用 long 防溢出）
    private int down(TreeNode node, long t) {
        if (node == null) {
            return 0;
        }
        return (node.val == t ? 1 : 0) + down(node.left, t - node.val) + down(node.right, t - node.val);  //@down
    }
}
