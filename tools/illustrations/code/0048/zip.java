class Solution {
    public void rotate(int[][] matrix) {
        int n = matrix.length;
        int[][] flip = new int[n][];                // 上下翻转：倒数第 i 行放到第 i 行 //@flip
        for (int i = 0; i < n; i++) {               //@flip
            flip[i] = matrix[n - 1 - i].clone();    //@flip
        }
        for (int j = 0; j < n; j++) {               // 结果的第 j 行 = 翻转后的第 j 列 //@col
            for (int i = 0; i < n; i++) {           //@col
                matrix[j][i] = flip[i][j];          //@col
            }
        }
    }
}
