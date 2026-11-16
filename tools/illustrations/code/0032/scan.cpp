class Solution {
public:
    int longestValidParentheses(string s) {
        string rev(s.rbegin(), s.rend());
        return max(scan(s, '('), scan(rev, ')'));      // 反过来扫描时把 ) 当成开括号 //@fwd,back,done
    }

private:
    int scan(const string& s, char opener) {
        int best = 0, l = 0, r = 0;                     //@fwd,back
        for (char c : s) {
            if (c == opener) l++;                       //@count
            else r++;                                   //@count
            if (l == r) {                               //@eq
                best = max(best, 2 * r);                //@eq
            } else if (r > l) {                         //@reset
                l = r = 0;                              //@reset
            }
        }
        return best;
    }
};
