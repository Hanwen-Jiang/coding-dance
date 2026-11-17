class Solution {
public:
    vector<string> letterCombinations(string digits) {
        if (digits.empty()) {
            return {};
        }
        this->digits = digits;                          //@init
        res.clear();                                    //@init
        path.clear();                                   //@init
        dfs(0);                                         //@init
        return res;                                     //@done
    }

private:
    const vector<string> phone{"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};
    string digits, path;
    vector<string> res;

    void dfs(int i) {
        if (i == (int)digits.size()) {                  //@record
            res.push_back(path);                        //@record
            return;                                     //@record
        }
        for (char ch : phone[digits[i] - '0']) {        //@pick
            path.push_back(ch);                         // 选 //@pick
            dfs(i + 1);                                 // 往下 //@pick
            path.pop_back();                            // 撤销 //@undo
        }
    }
};
