class Solution {
    public void flatten(TreeNode root) {
        TreeNode cur = root;                        //@init
        while (cur != null) {
            if (cur.left != null) {                 //@check
                TreeNode pre = cur.left;            //@pre0
                while (pre.right != null) {         // 左子树最右边的节点
                    pre = pre.right;                //@prestep
                }
                pre.right = cur.right;              // 原来的右子树接到它后面 //@hook
                cur.right = cur.left;               // 左子树挪到右边 //@move
                cur.left = null;                    // 断开左指针 //@clear
            }
            cur = cur.right;                        //@next
        }
    }
}
