var longestCommonSubsequence = function(text1, text2) {
    const n = text2.length;
    let prev = new Array(n + 1).fill(0);            // 第 0 行：text1 取空串，全是 0 //@init
    for (const a of text1) {                        //@row
        const cur = [0];                            // 这一行的第 0 列：text2 取空串，是 0 //@row
        for (let j = 0; j < n; j++) {
            cur.push(a === text2[j] ? prev[j] + 1 : Math.max(prev[j + 1], cur[j]));    // 左上 prev[j]，上面 prev[j+1]，左边 cur[j] //@same,diff
        }
        prev = cur;                                 // 这一行算完，成了下一行的「上一行」 //@next
    }
    return prev[n];                                 //@done
};