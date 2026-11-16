class Solution {
    private Map<Integer, Integer> idx = new HashMap<>();
    private int[] preorder;

    public TreeNode buildTree(int[] preorder, int[] inorder) {
        this.preorder = preorder;
        for (int i = 0; i < inorder.length; i++) {
            idx.put(inorder[i], i);                     // 值 -> 中序下标 //@init
        }
        return build(0, preorder.length, 0, inorder.length);   //@init,done
    }

    // 前序 [pl, pr)，中序 [il, ir)
    private TreeNode build(int pl, int pr, int il, int ir) {
        if (pl == pr) {
            return null;
        }
        TreeNode root = new TreeNode(preorder[pl]);     // 前序第一个是根 //@root
        int k = idx.get(root.val);                      //@root
        int leftSize = k - il;                          // 中序里根左边的都是左子树 //@root
        root.left = build(pl + 1, pl + 1 + leftSize, il, k);       //@sub
        root.right = build(pl + 1 + leftSize, pr, k + 1, ir);      //@sub
        return root;
    }
}
