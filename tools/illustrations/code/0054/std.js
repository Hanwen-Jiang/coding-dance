var spiralOrder = function(matrix) {
    const res = [];                                         //@init
    let top = 0, bottom = matrix.length - 1;                //@init
    let left = 0, right = matrix[0].length - 1;             //@init
    while (top <= bottom && left <= right) {
        for (let j = left; j <= right; j++) {               // 上边：左 -> 右 //@top
            res.push(matrix[top][j]);                       //@top
        }
        top++;                                              //@top
        for (let i = top; i <= bottom; i++) {               // 右边：上 -> 下 //@right
            res.push(matrix[i][right]);                     //@right
        }
        right--;                                            //@right
        if (top <= bottom) {                                //@bottom,skipb
            for (let j = right; j >= left; j--) {           // 下边：右 -> 左 //@bottom
                res.push(matrix[bottom][j]);                //@bottom
            }
            bottom--;                                       //@bottom
        }
        if (left <= right) {                                //@left,skipl
            for (let i = bottom; i >= top; i--) {           // 左边：下 -> 上 //@left
                res.push(matrix[i][left]);                  //@left
            }
            left++;                                         //@left
        }
    }
    return res;                                             //@done
};
