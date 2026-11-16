class Solution {
public:
    int lengthOfLIS(vector<int>& nums) {
        vector<int> tails;                              // tails[k]：长度 k+1 的递增子序列的最小结尾 //@init
        for (int x : nums) {
            auto it = lower_bound(tails.begin(), tails.end(), x);  // 第一个 >= x 的位置 //@add,rep
            if (it == tails.end()) tails.push_back(x);  // 比所有结尾都大，接在最后 //@add
            else *it = x;                               // 换成更小的结尾 //@rep
        }
        return tails.size();                            //@done
    }
};
