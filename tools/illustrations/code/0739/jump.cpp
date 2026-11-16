class Solution {
public:
    vector<int> dailyTemperatures(vector<int>& temperatures) {
        vector<int>& T = temperatures;
        int n = T.size();                           //@init
        vector<int> ans(n, 0);                      //@init
        for (int i = n - 2; i >= 0; i--) {          //@start
            int j = i + 1;                          //@start
            while (T[j] <= T[i] && ans[j]) {        //@jump
                j += ans[j];                        // 跳到比 T[j] 更热的那天 //@jump
            }
            if (T[j] > T[i]) {                      //@found,miss
                ans[i] = j - i;                     //@found
            }
        }
        return ans;                                 //@done
    }
};
