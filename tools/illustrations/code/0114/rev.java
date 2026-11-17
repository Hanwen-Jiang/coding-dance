class Solution {
    private TreeNode prev;

    public void flatten(TreeNode root) {
        prev = null;                                //@init
        dfs(root);                                  //@init
    }

    // 按 右 → 左 → 根 的顺序访问，从链表的尾巴往头接
    private void dfs(TreeNode node) {
        if (node == null) {
            return;
        }
        dfs(node.right);
        dfs(node.left);
        node.right = prev;                          //@link
        node.left = null;                           //@link
        prev = node;                                //@link
    }
}
