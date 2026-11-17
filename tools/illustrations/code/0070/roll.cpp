class Solution {
public:
    int climbStairs(int n) {
        int a = 1, b = 1;                               // 先是 dp[0]、dp[1] //@init
        for (int k = 0; k < n - 1; k++) {               //@step
            int next = a + b;                           // 往后挪一格：新的 b 是下一阶 //@step
            a = b;                                      //@step
            b = next;                                   //@step
        }
        return b;                                       //@done
    }
};
