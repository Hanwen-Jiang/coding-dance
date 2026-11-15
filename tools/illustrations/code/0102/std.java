class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        List<List<Integer>> res = new ArrayList<>();
        if (root == null) {
            return res;
        }
        Deque<TreeNode> q = new ArrayDeque<>();         //@init
        q.offer(root);                                  //@init
        while (!q.isEmpty()) {
            List<Integer> level = new ArrayList<>();    //@level
            int n = q.size();                           // 这一层有 n 个节点 //@level
            for (int i = 0; i < n; i++) {               //@level
                TreeNode node = q.poll();               //@pop
                level.add(node.val);                    //@pop
                if (node.left != null) {                //@push
                    q.offer(node.left);                 //@push
                }
                if (node.right != null) {               //@push
                    q.offer(node.right);                //@push
                }
            }
            res.add(level);                             //@end
        }
        return res;                                     //@done
    }
}
