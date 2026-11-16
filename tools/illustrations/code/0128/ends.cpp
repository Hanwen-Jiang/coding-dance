class Solution {
public:
    int longestConsecutive(vector<int>& nums) {
        unordered_map<int, int> lens;                   //@init
        int best = 0;                                   //@init
        for (int x : nums) {
            if (!lens.count(x)) {                       //@dup
                int l = lens.count(x - 1) ? lens[x - 1] : 0;    //@join
                int r = lens.count(x + 1) ? lens[x + 1] : 0;    //@join
                int len = l + r + 1;                    //@join
                lens[x] = len;                          //@join
                lens[x - l] = len;                      // 只更新新段的两个端点 //@join
                lens[x + r] = len;                      //@join
                best = max(best, len);                  //@join
            }
        }
        return best;                                    //@done
    }
};
