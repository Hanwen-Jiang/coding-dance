class Solution {
public:
    bool isValid(string s) {
        unordered_map<char, char> pairs = {{')', '('}, {']', '['}, {'}', '{'}};    //@init
        vector<char> stack;                             //@init
        for (char ch : s) {
            if (pairs.count(ch)) {                      // 右括号 //@match
                if (stack.empty() || stack.back() != pairs[ch]) {   //@match
                    return false;                       //@bad
                }
                stack.pop_back();                       //@match
            } else {                                    // 左括号 //@push
                stack.push_back(ch);                    //@push
            }
        }
        return stack.empty();                           //@done
    }
};
