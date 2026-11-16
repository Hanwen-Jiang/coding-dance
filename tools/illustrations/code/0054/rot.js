var spiralOrder = function(matrix) {
    const res = [];                                         //@init
    while (matrix.length) {
        res.push(...matrix.shift());                        // 拿走第一行 //@take
        // 剩下的逆时针转 90°：从最右一列开始，每一列变成新的一行
        const next = [];                                    //@turn
        const cols = matrix.length ? matrix[0].length : 0;  //@turn
        for (let c = cols - 1; c >= 0; c--) {               //@turn
            next.push(matrix.map((r) => r[c]));             //@turn
        }
        matrix = next;                                      //@turn
    }
    return res;                                             //@done
};
