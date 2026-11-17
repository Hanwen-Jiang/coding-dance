class Solution {
public:
    int knapsack(vector<int>& weights, vector<int>& values, int capacity) {
        vector<int> dp(capacity + 1, 0);                // 一行：一件物品都没有时全是 0 //@init
        for (int i = 0; i < (int)weights.size(); i++) { //@item
            int w = weights[i], v = values[i];          //@item
            for (int c = capacity; c >= w; c--) {       // 倒着更新：dp[c - w] 还是上一行的值 //@cell
                dp[c] = max(dp[c], dp[c - w] + v);      //@cell
            }
        }
        return dp[capacity];                            //@done
    }
};
