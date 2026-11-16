class Solution {
public:
    vector<int> spiralOrder(vector<vector<int>>& matrix) {
        vector<int> res;                                        //@init
        while (!matrix.empty()) {
            res.insert(res.end(), matrix[0].begin(), matrix[0].end());  // 拿走第一行 //@take
            matrix.erase(matrix.begin());                       //@take
            // 剩下的逆时针转 90°：从最右一列开始，每一列变成新的一行
            vector<vector<int>> next;                           //@turn
            int cols = matrix.empty() ? 0 : matrix[0].size();   //@turn
            for (int c = cols - 1; c >= 0; c--) {               //@turn
                vector<int> row;                                //@turn
                for (auto& r : matrix) {                        //@turn
                    row.push_back(r[c]);                        //@turn
                }
                next.push_back(row);                            //@turn
            }
            matrix = next;                                      //@turn
        }
        return res;                                             //@done
    }
};
