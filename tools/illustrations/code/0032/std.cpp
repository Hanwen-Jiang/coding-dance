class Solution {
public:
    int longestValidParentheses(string s) {
        vector<int> stack{-1};                          // 栈底：最后一个没匹配上的位置 //@init
        int best = 0;                                   //@init
        for (int i = 0; i < (int)s.size(); i++) {
            if (s[i] == '(') {                          //@open
                stack.push_back(i);                     //@open
            } else {                                    //@lone,match
                stack.pop_back();                       //@lone,match
                if (stack.empty()) {                    // 这个 ) 没人匹配，成为新的分界线 //@lone,match
                    stack.push_back(i);                 //@lone
                } else {                                //@match
                    best = max(best, i - stack.back()); //@match
                }
            }
        }
        return best;                                    //@done
    }
};
