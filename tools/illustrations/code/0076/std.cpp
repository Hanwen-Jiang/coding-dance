class Solution {
public:
    string minWindow(string s, string t) {
        int need[128] = {0};                        // 每种字符还差几个 //@init
        for (char c : t) need[c]++;                 //@init
        int missing = t.size();                     // 一共还差几个 //@init
        int l = 0, start = 0;                       //@init
        int size = INT_MAX;                         //@init
        for (int r = 0; r < (int)s.size(); r++) {   //@grow
            char ch = s[r];                         //@grow
            if (need[ch] > 0) {                     //@grow
                missing--;                          //@grow
            }
            need[ch]--;                             //@grow
            while (missing == 0) {                  // 窗口合格，尝试收缩 //@shrink
                if (r - l + 1 < size) {             //@shrink
                    start = l;                      //@shrink
                    size = r - l + 1;               //@shrink
                }
                need[s[l]]++;                       //@shrink
                if (need[s[l]] > 0) {               //@shrink
                    missing++;                      //@broke
                }
                l++;                                //@shrink
            }
        }
        return size == INT_MAX ? "" : s.substr(start, size);   //@done
    }
};
