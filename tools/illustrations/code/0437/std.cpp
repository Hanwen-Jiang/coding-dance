class Solution {
public:
    int pathSum(TreeNode* root, int targetSum) {
        unordered_map<long long, int> cnt;              //@init
        cnt[0] = 1;                                     // 空前缀：路径从根开始 //@init
        function<int(TreeNode*, long long)> dfs = [&](TreeNode* node, long long cur) {
            if (!node) {
                return 0;
            }
            cur += node->val;                           // 根到 node 的前缀和（可能超过 int，用 long long） //@visit
            int res = cnt.count(cur - targetSum) ? cnt[cur - targetSum] : 0;   // 前面有几个前缀和差正好是 targetSum //@visit
            cnt[cur]++;
            res += dfs(node->left, cur) + dfs(node->right, cur);
            cnt[cur]--;                                 // 回溯：离开这条路径
            return res;
        };
        return dfs(root, 0);                            //@init,done
    }
};
