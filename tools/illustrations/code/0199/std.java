class Solution {
    public List<Integer> rightSideView(TreeNode root) {
        List<Integer> res = new ArrayList<>();          //@init
        Deque<TreeNode> q = new ArrayDeque<>();         //@init
        if (root != null) q.offer(root);                //@init
        while (!q.isEmpty()) {                          //@level
            res.add(q.peekLast().val);                  // 这一层最右边的节点 //@level
            for (int i = q.size(); i > 0; i--) {        //@level
                TreeNode node = q.poll();               //@level
                if (node.left != null) q.offer(node.left);      //@level
                if (node.right != null) q.offer(node.right);    //@level
            }
        }
        return res;                                     //@done
    }
}
