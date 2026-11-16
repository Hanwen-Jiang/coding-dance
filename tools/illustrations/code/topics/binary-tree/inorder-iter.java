class Solution {
    public List<Integer> inorderTraversal(TreeNode root) {
        List<Integer> res = new ArrayList<>();          //@init
        Deque<TreeNode> stack = new ArrayDeque<>();     //@init
        TreeNode cur = root;                            //@init
        while (cur != null || !stack.isEmpty()) {       //@loop
            while (cur != null) {                       // 一路往左走，沿途的节点压栈 //@push
                stack.push(cur);                        //@push
                cur = cur.left;                         //@push
            }
            cur = stack.pop();                          // 左边到头了，弹出来访问 //@pop
            res.add(cur.val);                           //@pop
            cur = cur.right;                            // 再去它的右子树 //@right
        }
        return res;                                     //@done
    }
}
