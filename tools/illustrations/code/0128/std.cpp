class Solution {
public:
    int longestConsecutive(vector<int>& nums) {
        unordered_set<int> s(nums.begin(), nums.end()); //@init
        int best = 0;                               //@init
        for (int x : s) {                           // 遍历集合，不是遍历 nums
            if (s.count(x - 1)) {                   //@skip
                continue;                           // 不是起点，跳过 //@skip
            }
            int y = x;                              //@start
            while (s.count(y + 1)) {                //@count
                y++;                                //@count
            }
            best = max(best, y - x + 1);            //@best
        }
        return best;                                //@done
    }
};
