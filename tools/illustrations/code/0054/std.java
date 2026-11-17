class Solution {
    public List<Integer> spiralOrder(int[][] matrix) {
        List<Integer> res = new ArrayList<>();                  //@init
        int top = 0, bottom = matrix.length - 1;                //@init
        int left = 0, right = matrix[0].length - 1;             //@init
        while (top <= bottom && left <= right) {
            for (int j = left; j <= right; j++) {               // 上边：左 -> 右 //@top
                res.add(matrix[top][j]);                        //@top
            }
            top++;                                              //@top
            for (int i = top; i <= bottom; i++) {               // 右边：上 -> 下 //@right
                res.add(matrix[i][right]);                      //@right
            }
            right--;                                            //@right
            if (top <= bottom) {                                //@bottom,skipb
                for (int j = right; j >= left; j--) {           // 下边：右 -> 左 //@bottom
                    res.add(matrix[bottom][j]);                 //@bottom
                }
                bottom--;                                       //@bottom
            }
            if (left <= right) {                                //@left,skipl
                for (int i = bottom; i >= top; i--) {           // 左边：下 -> 上 //@left
                    res.add(matrix[i][left]);                   //@left
                }
                left++;                                         //@left
            }
        }
        return res;                                             //@done
    }
}
