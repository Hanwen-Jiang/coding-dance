class Solution {
public:
    vector<vector<string>> partition(string s) {
        vector<vector<string>> res;                 //@init
        vector<string> path;                        //@init
        function<void(int)> dfs = [&](int start) {
            if (start == (int)s.size()) {           //@collect
                res.push_back(path);                //@collect
                return;                             //@collect
            }
            for (int end = start + 1; end <= (int)s.size(); end++) {    //@try
                string piece = s.substr(start, end - start);            //@try
                if (piece == string(piece.rbegin(), piece.rend())) {    // 这一段是回文才切 //@try,cut
                    path.push_back(piece);          //@cut
                    dfs(end);                       //@cut
                    path.pop_back();                //@back
                }
            }
        };
        dfs(0);                                     //@init
        return res;                                 //@done
    }
};
