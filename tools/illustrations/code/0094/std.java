class Solution {
    public List<Integer> inorderTraversal(TreeNode root) {
        List<Integer> res = new ArrayList<>();      //@init
        dfs(root, res);                             //@init
        return res;                                 //@done
    }

    private void dfs(TreeNode node, List<Integer> res) {
        if (node == null) {                         //@enter
            return;
        }
        dfs(node.left, res);                        // 左 //@enter
        res.add(node.val);                          // 自己 //@visit
        dfs(node.right, res);                       // 右 //@visit
    }
}
