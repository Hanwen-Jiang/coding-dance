class Solution {
public:
    bool searchMatrix(vector<vector<int>>& matrix, int target) {
        int i = 0, j = (int)matrix[0].size() - 1;   // 右上角 //@init
        while (i < (int)matrix.size() && j >= 0) {
            int x = matrix[i][j];                   //@cmp
            if (x == target) {                      //@found
                return true;                        //@found
            }
            if (x > target) {                       //@left
                j--;                                // 这一列都太大 //@left
            } else {
                i++;                                // 这一行都太小 //@down
            }
        }
        return false;                               //@none
    }
};
