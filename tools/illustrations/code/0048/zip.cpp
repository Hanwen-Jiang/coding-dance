class Solution {
public:
    void rotate(vector<vector<int>>& matrix) {
        int n = matrix.size();
        vector<vector<int>> flip(matrix.rbegin(), matrix.rend());   // 上下翻转 //@flip
        for (int j = 0; j < n; j++) {               // 结果的第 j 行 = 翻转后的第 j 列 //@col
            for (int i = 0; i < n; i++) {           //@col
                matrix[j][i] = flip[i][j];          //@col
            }
        }
    }
};
