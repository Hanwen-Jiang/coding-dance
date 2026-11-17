class Solution {
    public int[] corpFlightBookings(int[][] bookings, int n) {
        int[] diff = new int[n + 1];                // diff[i] = ans[i] - ans[i-1] //@init
        for (int[] b : bookings) {                  //@add
            diff[b[0] - 1] += b[2];                 // 从 first 开始多了 seats //@add
            diff[b[1]] -= b[2];                     // 过了 last 又少了 seats //@add
        }
        int[] ans = new int[n];
        int cur = 0;
        for (int i = 0; i < n; i++) {               //@sum
            cur += diff[i];                         // 前缀和还原出每个位置的值 //@sum
            ans[i] = cur;                           //@sum
        }
        return ans;                                 //@done
    }
}
