class Solution {
    public boolean hasPathSum(TreeNode root, int targetSum) {
        if (root == null) {                             //@base
            return false;                               //@base
        }
        int rest = targetSum - root.val;                // 往下还要凑多少 //@visit
        if (root.left == null && root.right == null) {  // 叶子：看是不是正好凑够 //@leaf
            return rest == 0;                           //@leaf
        }
        return hasPathSum(root.left, rest) || hasPathSum(root.right, rest);     //@down
    }
}
