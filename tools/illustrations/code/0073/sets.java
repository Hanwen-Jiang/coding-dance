class Solution {
    public void setZeroes(int[][] matrix) {
        int m = matrix.length, n = matrix[0].length;
        boolean[] rows = new boolean[m], cols = new boolean[n];    // 要清零的行、列
        for (int i = 0; i < m; i++) {                   //@find
            for (int j = 0; j < n; j++) {               //@find
                if (matrix[i][j] == 0) {                //@find
                    rows[i] = cols[j] = true;           //@find
                }
            }
        }
        for (int i = 0; i < m; i++) {                   //@clear
            for (int j = 0; j < n; j++) {               //@clear
                if (rows[i] || cols[j]) {               //@clear
                    matrix[i][j] = 0;                   //@clear
                }
            }
        }
    }
}
