class Solution {
public:
    string longestPalindrome(string s) {
        int n = s.size();
        auto expand = [&](int l, int r) {
            while (l >= 0 && r < n && s[l] == s[r]) {       //@grow,miss
                l--;                                        //@grow
                r++;                                        //@grow
            }
            return pair<int, int>{l + 1, r - 1};            // 退回最后一次成功的位置 //@grow
        };
        int start = 0, end = 0;                             //@init
        for (int i = 0; i < n; i++) {
            for (auto [l, r] : {expand(i, i), expand(i, i + 1)}) {  // 奇数中心、偶数中心 //@grow,miss
                if (r - l > end - start) {                  //@grow,update
                    start = l;                              //@update
                    end = r;                                //@update
                }
            }
        }
        return s.substr(start, end - start + 1);            //@done
    }
};
