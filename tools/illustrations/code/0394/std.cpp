class Solution {
public:
    string decodeString(string s) {
        vector<pair<string, int>> stack;                //@init
        string cur;                                     //@init
        int k = 0;                                      //@init
        for (char c : s) {
            if (isdigit(c)) {                           //@digit
                k = k * 10 + (c - '0');                 // 数字可能不止一位 //@digit
            } else if (c == '[') {                      //@push
                stack.push_back({cur, k});              // 存档：括号外的前缀和重复次数 //@push
                cur = "";                               //@push
                k = 0;                                  //@push
            } else if (c == ']') {                      //@pop
                auto [prev, times] = stack.back();      //@pop
                stack.pop_back();                       //@pop
                string inner;                           //@pop
                while (times--) inner += cur;           //@pop
                cur = prev + inner;                     // 展开后接回前缀 //@pop
            } else {                                    //@letter
                cur += c;                               //@letter
            }
        }
        return cur;                                     //@done
    }
};
