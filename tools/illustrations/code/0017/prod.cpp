class Solution {
public:
    vector<string> letterCombinations(string digits) {
        if (digits.empty()) {                           //@empty
            return {};                                  //@empty
        }
        vector<string> phone{"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};    //@init
        vector<string> combos{""};                      // 一开始只有一个空前缀 //@init
        for (char d : digits) {                         //@mul
            vector<string> next;                        //@mul
            for (const string& c : combos) {            //@mul
                for (char ch : phone[d - '0']) {        //@mul
                    next.push_back(c + ch);             // 每个前缀后面接上这一位的每个字母 //@mul
                }
            }
            combos = next;                              //@mul
        }
        return combos;                                  //@done
    }
};
