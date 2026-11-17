class Solution {
    private int best;

    public int maxPathSum(TreeNode root) {
        best = Integer.MIN_VALUE;                       //@init
        gain(root);                                     //@init
        return best;                                    //@done
    }

    // 从 node 往下一条链的最大和
    private int gain(TreeNode node) {
        if (node == null) return 0;
        int l = Math.max(gain(node.left), 0);           // 负的就不要了 //@node
        int r = Math.max(gain(node.right), 0);          //@node
        best = Math.max(best, node.val + l + r);        // 以 node 为最高点的路径 //@node
        return node.val + Math.max(l, r);               // 往上只能带一条链 //@node
    }
}
