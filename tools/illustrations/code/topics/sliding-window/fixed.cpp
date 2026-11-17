class Solution {
    bool isVowel(char c) {
        return c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u';
    }

public:
    int maxVowels(string s, int k) {
        int cnt = 0;
        for (int i = 0; i < k; i++) {               // 第一个窗口 //@init
            cnt += isVowel(s[i]);                   //@init
        }
        int best = cnt;                             //@init
        for (int i = k; i < (int)s.size(); i++) {   // 窗口右移一格 //@slide
            cnt += isVowel(s[i]) - isVowel(s[i - k]);   // 进来 s[i]，出去 s[i-k] //@slide
            best = max(best, cnt);                  //@slide
        }
        return best;                                //@done
    }
};
