class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        unordered_map<string, vector<string>> groups;   //@init
        for (const string& s : strs) {
            string key = s;                             //@key
            sort(key.begin(), key.end());               // 异位词排序后相同 //@key
            groups[key].push_back(s);                   //@add
        }
        vector<vector<string>> res;                     //@done
        for (auto& [key, g] : groups) {                 //@done
            res.push_back(g);                           //@done
        }
        return res;                                     //@done
    }
};
