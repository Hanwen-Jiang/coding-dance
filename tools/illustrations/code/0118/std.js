var generate = function(numRows) {
    const res = [];                                 //@init
    for (let i = 0; i < numRows; i++) {             //@row
        const row = new Array(i + 1).fill(1);       // 首尾是 1 //@row
        for (let j = 1; j < i; j++) {               //@mid
            row[j] = res[i - 1][j - 1] + res[i - 1][j];     //@mid
        }
        res.push(row);                              //@row
    }
    return res;                                     //@done
};
