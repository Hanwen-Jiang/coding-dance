class Solution {
    private final Map<Long, Integer> cnt = new HashMap<>();
    private int target;

    public int pathSum(TreeNode root, int targetSum) {
        target = targetSum;
        cnt.clear();                                    //@init
        cnt.put(0L, 1);                                 // 空前缀：路径从根开始 //@init
        return dfs(root, 0);                            //@init,done
    }

    private int dfs(TreeNode node, long cur) {
        if (node == null) {
            return 0;
        }
        cur += node.val;                                // 根到 node 的前缀和（可能超过 int，用 long） //@visit
        int res = cnt.getOrDefault(cur - target, 0);    // 前面有几个前缀和差正好是 targetSum //@visit
        cnt.merge(cur, 1, Integer::sum);
        res += dfs(node.left, cur) + dfs(node.right, cur);
        cnt.merge(cur, -1, Integer::sum);               // 回溯：离开这条路径
        return res;
    }
}
