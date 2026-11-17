class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) {                 //@base
            return 0;                       //@base
        }
        return Math.max(maxDepth(root.left), maxDepth(root.right)) + 1;    //@down,depth
    }
}
