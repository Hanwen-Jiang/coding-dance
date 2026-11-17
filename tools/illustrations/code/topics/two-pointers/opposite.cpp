class Solution {
public:
    vector<int> twoSum(vector<int>& numbers, int target) {
        int l = 0, r = numbers.size() - 1;      // 一头一尾 //@init
        while (l < r) {
            int s = numbers[l] + numbers[r];    //@sum
            if (s == target) {                  //@hit
                return {l + 1, r + 1};          // 题目的下标从 1 开始 //@hit
            }
            if (s < target) {                   // 太小：numbers[l] 和谁配都不够 //@small
                l++;                            //@small
            } else {                            // 太大：numbers[r] 和谁配都太大 //@big
                r--;                            //@big
            }
        }
        return {};
    }
};
