class Solution {
public:
    vector<int> dailyTemperatures(vector<int>& temperatures) {
        int n = temperatures.size();
        vector<int> ans(n, 0);                      //@init
        vector<int> stack;                          // 还在等待的日子（下标），温度从底到顶递减 //@init
        for (int i = 0; i < n; i++) {
            while (!stack.empty() && temperatures[stack.back()] < temperatures[i]) {    //@pop
                int j = stack.back();               //@pop
                stack.pop_back();                   //@pop
                ans[j] = i - j;                     // 第 j 天等到了第 i 天 //@pop
            }
            stack.push_back(i);                     //@push
        }
        return ans;                                 //@done
    }
};
