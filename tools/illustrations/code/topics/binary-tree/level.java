class Solution {
    public List<Integer> largestValues(TreeNode root) {
        List<Integer> res = new ArrayList<>();
        Deque<TreeNode> q = new ArrayDeque<>();     //@init
        if (root != null) {                         //@init
            q.offer(root);                          //@init
        }
        while (!q.isEmpty()) {
            int best = q.peek().val;                //@level
            for (int n = q.size(); n > 0; n--) {    // 这一层有 q.size() 个节点 //@level
                TreeNode node = q.poll();           //@pop
                best = Math.max(best, node.val);    //@pop
                if (node.left != null) {            //@push
                    q.offer(node.left);             //@push
                }
                if (node.right != null) {           //@push
                    q.offer(node.right);            //@push
                }
            }
            res.add(best);                          //@end
        }
        return res;                                 //@done
    }
}
