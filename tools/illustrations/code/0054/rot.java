class Solution {
    public List<Integer> spiralOrder(int[][] matrix) {
        List<Integer> res = new ArrayList<>();                  //@init
        while (matrix.length > 0) {
            for (int x : matrix[0]) {                           // 拿走第一行 //@take
                res.add(x);                                     //@take
            }
            // 剩下的 rows 行逆时针转 90°：从最右一列开始，每一列变成新的一行
            int rows = matrix.length - 1, cols = rows > 0 ? matrix[0].length : 0;  //@turn
            int[][] next = new int[cols][rows];                 //@turn
            for (int c = cols - 1; c >= 0; c--) {               //@turn
                for (int j = 0; j < rows; j++) {                //@turn
                    next[cols - 1 - c][j] = matrix[j + 1][c];   //@turn
                }
            }
            matrix = next;                                      //@turn
        }
        return res;                                             //@done
    }
}
