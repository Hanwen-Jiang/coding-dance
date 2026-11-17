class Solution {
    public TreeNode invertTree(TreeNode root) {
        if (root == null) {                 //@base
            return null;                    //@base
        }
        TreeNode t = root.left;             // 交换左右孩子 //@swap
        root.left = root.right;             //@swap
        root.right = t;                     //@swap
        invertTree(root.left);              //@rec
        invertTree(root.right);             //@rec
        return root;                        //@done
    }
}
