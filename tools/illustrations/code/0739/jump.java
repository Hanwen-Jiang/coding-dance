class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        int[] T = temperatures;
        int n = T.length;                           //@init
        int[] ans = new int[n];                     //@init
        for (int i = n - 2; i >= 0; i--) {          //@start
            int j = i + 1;                          //@start
            while (T[j] <= T[i] && ans[j] != 0) {   //@jump
                j += ans[j];                        // 跳到比 T[j] 更热的那天 //@jump
            }
            if (T[j] > T[i]) {                      //@found,miss
                ans[i] = j - i;                     //@found
            }
        }
        return ans;                                 //@done
    }
}
