class Solution {
    public int kthSmallest(TreeNode root, int k) {
        Deque<TreeNode> stack = new ArrayDeque<>();     //@init
        TreeNode cur = root;                            //@init
        while (true) {
            while (cur != null) {                       // 一路向左 //@left
                stack.push(cur);                        //@left
                cur = cur.left;                         //@left
            }
            cur = stack.pop();                          //@pop
            k--;                                        //@pop
            if (k == 0) {                               // 中序遍历的第 k 个 //@found
                return cur.val;                         //@found
            }
            cur = cur.right;                            //@right
        }
    }
}
