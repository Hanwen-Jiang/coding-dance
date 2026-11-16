class Solution {
public:
    bool isValid(string s) {
        auto has = [&](const string& p) { return s.find(p) != string::npos; };
        while (has("()") || has("[]") || has("{}")) {   //@round
            for (string p : {"()", "[]", "{}"}) {       // 依次删掉每一种相邻的一对 //@del
                string t;                               //@del
                for (size_t i = 0; i < s.size(); i++) { //@del
                    if (s.compare(i, 2, p) == 0) i++;   // 跳过这一对 //@del
                    else t += s[i];                     //@del
                }
                s = t;                                  //@del
            }
        }
        return s.empty();                               //@done
    }
};
