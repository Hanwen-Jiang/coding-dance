class Solution {
public:
    int rob(vector<int>& nums) {
        int prev = 0, cur = 0;                          // dp[-1]（越界）和 dp[0]（没有房子），都是 0 //@init
        for (int x : nums) {                            //@step
            int next = max(cur, prev + x);              // 不偷：cur；偷：prev + x //@step
            prev = cur;                                 //@step
            cur = next;                                 //@step
        }
        return cur;                                     //@done
    }
};
