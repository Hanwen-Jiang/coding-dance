class Solution {
    public void setZeroes(int[][] matrix) {
        int m = matrix.length, n = matrix[0].length;    //@first
        boolean row0 = false, col0 = false;             //@first
        for (int j = 0; j < n; j++) {                   // 第一行原来有没有 0 //@first
            if (matrix[0][j] == 0) row0 = true;         //@first
        }
        for (int i = 0; i < m; i++) {                   // 第一列原来有没有 0 //@first
            if (matrix[i][0] == 0) col0 = true;         //@first
        }
        for (int i = 1; i < m; i++) {
            for (int j = 1; j < n; j++) {
                if (matrix[i][j] == 0) {                //@mark
                    matrix[i][0] = matrix[0][j] = 0;    // 做记号 //@mark
                }
            }
        }
        for (int i = 1; i < m; i++) {                   //@clear
            for (int j = 1; j < n; j++) {               //@clear
                if (matrix[i][0] == 0 || matrix[0][j] == 0) {   //@clear
                    matrix[i][j] = 0;                   //@clear
                }
            }
        }
        if (row0) {                                     //@edge
            for (int j = 0; j < n; j++) {               //@edge
                matrix[0][j] = 0;                       //@edge
            }
        }
        if (col0) {                                     //@edge
            for (int i = 0; i < m; i++) {               //@edge
                matrix[i][0] = 0;                       //@edge
            }
        }
    }
}
