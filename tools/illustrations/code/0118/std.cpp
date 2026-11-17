class Solution {
public:
    vector<vector<int>> generate(int numRows) {
        vector<vector<int>> res;                        //@init
        for (int i = 0; i < numRows; i++) {             //@row
            vector<int> row(i + 1, 1);                  // 首尾是 1 //@row
            for (int j = 1; j < i; j++) {               //@mid
                row[j] = res[i - 1][j - 1] + res[i - 1][j];     //@mid
            }
            res.push_back(row);                         //@row
        }
        return res;                                     //@done
    }
};
