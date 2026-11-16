class Solution {
    private int best = 0;                       //@init

    public int diameterOfBinaryTree(TreeNode root) {
        depth(root);                            //@init
        return best;                            //@done
    }

    private int depth(TreeNode node) {
        if (node == null) {
            return 0;
        }
        int l = depth(node.left), r = depth(node.right);    //@calc
        best = Math.max(best, l + r);           // 在这个节点拐弯的最长路径 //@calc
        return Math.max(l, r) + 1;              // 返回给上一层的是深度 //@calc
    }
}
