class Solution {
    public List<Integer> rightSideView(TreeNode root) {
        List<Integer> res = new ArrayList<>();          //@init
        dfs(root, 0, res);                              //@init
        return res;                                     //@done
    }

    private void dfs(TreeNode node, int depth, List<Integer> res) {
        if (node == null) return;
        if (depth == res.size()) {                      // 这一层第一次到 //@first,pass
            res.add(node.val);                          //@first
        }
        dfs(node.right, depth + 1, res);                // 先右
        dfs(node.left, depth + 1, res);                 // 后左
    }
}
