class Solution {
public:
    bool canPartition(vector<int>& nums) {
        int total = 0;                              //@init
        bitset<20001> bits(1);                      // 第 j 位是 1：能凑出和 j（总和最多 200 × 100） //@init
        for (int x : nums) {                        //@add
            total += x;                             //@add
            bits |= bits << x;                      //@add
        }
        return total % 2 == 0 && bits[total / 2];   //@done
    }
};
