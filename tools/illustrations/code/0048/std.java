class Solution {
    public void rotate(int[][] matrix) {
        int n = matrix.length;                      //@init
        for (int i = 0; i < n; i++) {               //@swap
            for (int j = i + 1; j < n; j++) {       // 只换对角线上方的一半 //@swap
                int tmp = matrix[i][j];             //@swap
                matrix[i][j] = matrix[j][i];        //@swap
                matrix[j][i] = tmp;                 //@swap
            }
        }
        for (int[] row : matrix) {                  //@flip
            for (int l = 0, r = n - 1; l < r; l++, r--) {   // 左右翻转这一行 //@flip
                int tmp = row[l];                   //@flip
                row[l] = row[r];                    //@flip
                row[r] = tmp;                       //@flip
            }
        }
    }
}
