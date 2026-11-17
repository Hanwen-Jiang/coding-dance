class Solution {
public:
    int missingNumber(vector<int>& nums) {
        int x = nums.size();                    // 0..n 里的 n 先放进来 //@init
        for (int i = 0; i < (int)nums.size(); i++) {    //@loop
            x ^= i ^ nums[i];                   // 出现两次的数异或后抵消 //@xor
        }
        return x;                               //@done
    }
};
