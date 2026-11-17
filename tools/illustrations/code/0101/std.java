class Solution {
    public boolean isSymmetric(TreeNode root) {
        return check(root.left, root.right);        //@start
    }

    // a 和 b 两棵子树是否互为镜像
    private boolean check(TreeNode a, TreeNode b) {
        if (a == null && b == null) {               //@both
            return true;                            //@both
        }
        if (a == null || b == null || a.val != b.val) { //@diff
            return false;                           //@diff
        }
        return check(a.left, b.right) && check(a.right, b.left);   //@same
    }
}
