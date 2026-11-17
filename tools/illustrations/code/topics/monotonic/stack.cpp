class Solution {
public:
    vector<int> finalPrices(vector<int>& prices) {
        vector<int> ans = prices;
        vector<int> st;                                 // 还没找到折扣的下标，价格从栈底到栈顶递增 //@init
        for (int i = 0; i < (int)prices.size(); i++) {  //@loop
            while (!st.empty() && prices[st.back()] >= prices[i]) { // prices[i] 是它右边第一个不超过它的价格 //@pop
                ans[st.back()] -= prices[i];            //@pop
                st.pop_back();                          //@pop
            }
            st.push_back(i);                            //@push
        }
        return ans;                                     //@done
    }
};
