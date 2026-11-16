class Solution {
public:
    int singleNumber(vector<int>& nums) {
        int res = 0;                        //@init
        for (int x : nums) {                //@xor
            res ^= x;                       // 成对的数会互相抵消 //@xor
        }
        return res;                         //@done
    }
};
