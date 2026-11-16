class Solution {
public:
    void rotate(vector<vector<int>>& matrix) {
        int n = matrix.size();                      //@init
        for (int i = 0; i < n; i++) {               //@swap
            for (int j = i + 1; j < n; j++) {       // 只换对角线上方的一半 //@swap
                swap(matrix[i][j], matrix[j][i]);   //@swap
            }
        }
        for (auto& row : matrix) {                  //@flip
            reverse(row.begin(), row.end());        //@flip
        }
    }
};
