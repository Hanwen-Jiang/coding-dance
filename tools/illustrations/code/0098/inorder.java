class Solution {
    private long prev = Long.MIN_VALUE;         // 比任何 int 都小 //@init

    public boolean isValidBST(TreeNode root) {
        return inorder(root);                   //@done
    }

    private boolean inorder(TreeNode node) {
        if (node == null) {
            return true;
        }
        if (!inorder(node.left)) {
            return false;
        }
        if (node.val <= prev) {                 // 必须比前一个大 //@bad
            return false;                       //@bad
        }
        prev = node.val;                        //@ok
        return inorder(node.right);
    }
}
