class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_map<char, int> last;                      //@init
        int left = 0, best = 0;                             //@init
        for (int i = 0; i < (int)s.size(); i++) {
            char c = s[i];
            if (last.count(c) && last[c] >= left) {         // c 在窗口里出现过 //@jump,grow
                left = last[c] + 1;                         //@jump
            }
            last[c] = i;                                    //@jump,grow
            best = max(best, i - left + 1);                 //@jump,grow
        }
        return best;                                        //@done
    }
};
