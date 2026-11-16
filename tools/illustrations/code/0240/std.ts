function searchMatrix(matrix: number[][], target: number): boolean {
    let i = 0, j = matrix[0].length - 1;        // 右上角 //@init
    while (i < matrix.length && j >= 0) {
        const x = matrix[i][j];                 //@cmp
        if (x === target) {                     //@found
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
