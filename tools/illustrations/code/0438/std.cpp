class Solution {
public:
    vector<int> findAnagrams(string s, string p) {
        int m = p.size();                                   //@init
        vector<int> res;                                    //@init
        array<int, 26> need{}, win{};                       // 每个字母出现的次数 //@init
        for (char c : p) {                                  //@init
            need[c - 'a']++;                                //@init
        }
        for (int r = 0; r < s.size(); r++) {
            win[s[r] - 'a']++;                              // 右边进 //@in
            if (r >= m) {
                win[s[r - m] - 'a']--;                      // 左边出 //@out
            }
            if (win == need) {                              //@cmp
                res.push_back(r - m + 1);                   //@hit
            }
        }
        return res;                                         //@done
    }
};
