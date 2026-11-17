class Solution {
public:
    vector<int> corpFlightBookings(vector<vector<int>>& bookings, int n) {
        vector<int> diff(n + 1, 0);                 // diff[i] = ans[i] - ans[i-1] //@init
        for (auto& b : bookings) {                  //@add
            diff[b[0] - 1] += b[2];                 // 从 first 开始多了 seats //@add
            diff[b[1]] -= b[2];                     // 过了 last 又少了 seats //@add
        }
        vector<int> ans(n);
        int cur = 0;
        for (int i = 0; i < n; i++) {               //@sum
            cur += diff[i];                         // 前缀和还原出每个位置的值 //@sum
            ans[i] = cur;                           //@sum
        }
        return ans;                                 //@done
    }
};
