function pathSum(root: TreeNode | null, targetSum: number): number {
    const cnt = new Map<number, number>([[0, 1]]);  // 空前缀：路径从根开始 //@init
    const dfs = (node: TreeNode | null, cur: number): number => {
        if (!node) {
            return 0;
        }
        cur += node.val;                            // 根到 node 的前缀和 //@visit
        let res = cnt.get(cur - targetSum) ?? 0;    // 前面有几个前缀和差正好是 targetSum //@visit
        cnt.set(cur, (cnt.get(cur) ?? 0) + 1);
        res += dfs(node.left, cur) + dfs(node.right, cur);
        cnt.set(cur, cnt.get(cur)! - 1);            // 回溯：离开这条路径
        return res;
    };
    return dfs(root, 0);                            //@init,done
}
