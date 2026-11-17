class Solution {
public:
    int majorityElement(vector<int>& nums) {
        int cand = 0, count = 0;                    //@init
        for (int x : nums) {
            if (count == 0) {                       //@new
                cand = x;                           // 票数归零，换候选人 //@new
            }
            count += x == cand ? 1 : -1;            // 相同 +1，不同就抵消一票 //@vote,new
        }
        return cand;                                //@done
    }
};
