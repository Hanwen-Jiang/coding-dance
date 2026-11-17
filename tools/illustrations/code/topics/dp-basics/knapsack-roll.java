class Solution {
    public int knapsack(int[] weights, int[] values, int capacity) {
        int[] dp = new int[capacity + 1];               // 一行：一件物品都没有时全是 0 //@init
        for (int i = 0; i < weights.length; i++) {      //@item
            int w = weights[i], v = values[i];          //@item
            for (int c = capacity; c >= w; c--) {       // 倒着更新：dp[c - w] 还是上一行的值 //@cell
                dp[c] = Math.max(dp[c], dp[c - w] + v); //@cell
            }
        }
        return dp[capacity];                            //@done
    }
}
