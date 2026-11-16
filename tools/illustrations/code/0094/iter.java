class Solution {
    public List<Integer> inorderTraversal(TreeNode root) {
        List<Integer> res = new ArrayList<>();      //@init
        Deque<TreeNode> stack = new ArrayDeque<>(); //@init
        TreeNode cur = root;                        //@init
        while (cur != null || !stack.isEmpty()) {
            while (cur != null) {                   // 一路向左，沿途入栈 //@left
                stack.push(cur);                    //@left
                cur = cur.left;                     //@left
            }
            cur = stack.pop();                      //@pop
            res.add(cur.val);                       //@pop
            cur = cur.right;                        // 转向右子树 //@pop
        }
        return res;                                 //@done
    }
}
