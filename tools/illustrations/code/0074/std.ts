function searchMatrix(matrix: number[][], target: number): boolean {
    const m = matrix.length, n = matrix[0].length;  //@init
    let lo = 0, hi = m * n - 1;                     // 当成长度 m·n 的有序数组 //@init
    while (lo <= hi) {                              //@loop
        const mid = (lo + hi) >> 1;                 //@loop
        const x = matrix[Math.floor(mid / n)][mid % n];     // 一维下标换回行列 //@loop
        if (x === target) {                         //@found
            return true;                            //@found
        }
        if (x < target) {                           //@small
            lo = mid + 1;                           //@small
        } else {                                    //@big
            hi = mid - 1;                           //@big
        }
    }
    return false;                                   //@none
}
