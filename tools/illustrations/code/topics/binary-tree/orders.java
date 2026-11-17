class Solution {
    private final List<Integer> pre = new ArrayList<>(), ino = new ArrayList<>(), post = new ArrayList<>();

    public List<List<Integer>> traversals(TreeNode root) {
        dfs(root);                              //@start
        return List.of(pre, ino, post);         //@done
    }

    private void dfs(TreeNode node) {
        if (node == null) {                     //@base
            return;                             //@base
        }
        pre.add(node.val);                      // 前序：刚进入这个节点 //@pre
        dfs(node.left);                         //@left
        ino.add(node.val);                      // 中序：左子树走完了 //@in
        dfs(node.right);                        //@right
        post.add(node.val);                     // 后序：两棵子树都走完了 //@post
    }
}
