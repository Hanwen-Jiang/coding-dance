class Solution {
public:
    vector<int> partitionLabels(string s) {
        int last[26];                                   // 每个字母最后出现的位置 //@init
        for (int i = 0; i < (int)s.size(); i++) last[s[i] - 'a'] = i;  //@init
        vector<int> res;                                //@init
        int start = 0, end = 0;                         //@init
        for (int i = 0; i < (int)s.size(); i++) {       //@grow
            end = max(end, last[s[i] - 'a']);           // 这一段至少要到 end //@grow
            if (i == end) {                             // 走到边界，切一刀 //@cut
                res.push_back(end - start + 1);         //@cut
                start = i + 1;                          //@cut
            }
        }
        return res;                                     //@done
    }
};
