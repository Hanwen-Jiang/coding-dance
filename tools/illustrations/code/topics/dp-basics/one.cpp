class Solution {
public:
    int minCostClimbingStairs(vector<int>& cost) {
        int n = cost.size();
        vector<int> dp(n + 1, 0);           // 边界 dp[0] = dp[1] = 0：从第 0 或第 1 阶出发不花钱 //@init
        for (int i = 2; i <= n; i++) {
            dp[i] = min(dp[i - 1] + cost[i - 1], dp[i - 2] + cost[i - 2]);     // 跨 1 步或跨 2 步上来 //@step
        }
        return dp[n];                       // 楼顶是第 n 阶 //@done
    }
};
