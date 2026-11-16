class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_set<char> seen;                   // 窗口里的字符 //@init
        int l = 0, best = 0;                        //@init
        for (int r = 0; r < (int)s.size(); r++) {
            char ch = s[r];
            while (seen.count(ch)) {                // 有重复，左端收缩 //@shrink
                seen.erase(s[l]);                   //@shrink
                l++;                                //@shrink
            }
            seen.insert(ch);                        //@grow
            best = max(best, r - l + 1);            //@grow
        }
        return best;                                //@done
    }
};
