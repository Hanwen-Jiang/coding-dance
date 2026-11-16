class Solution {
    public void flatten(TreeNode root) {
        TreeNode cur = root;                        //@init
        while (cur != null) {
            if (cur.left != null) {                 //@pre,skip
                TreeNode pre = cur.left;            //@pre
                while (pre.right != null) {         // 左子树最右边的节点 //@pre
                    pre = pre.right;                //@pre
                }
                pre.right = cur.right;              // 原来的右子树接到它后面 //@move
                cur.right = cur.left;               // 左子树挪到右边 //@move
                cur.left = null;                    //@move
            }
            cur = cur.right;                        //@skip
        }
    }
}
