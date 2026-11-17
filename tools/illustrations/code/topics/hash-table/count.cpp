class Solution {
public:
    int firstUniqChar(string s) {
        unordered_map<char, int> cnt;               // 字符 -> 出现次数，没见过的默认是 0 //@init
        for (char ch : s) {                         //@count
            cnt[ch]++;                              //@count
        }
        for (int i = 0; i < (int)s.size(); i++) {   // 再按原来的顺序找 //@find
            if (cnt[s[i]] == 1) {                   //@find
                return i;                           //@hit
            }
        }
        return -1;                                  //@miss
    }
};
