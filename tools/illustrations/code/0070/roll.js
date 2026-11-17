var climbStairs = function(n) {
    let a = 1, b = 1;                               // 先是 dp[0]、dp[1] //@init
    for (let k = 0; k < n - 1; k++) {               //@step
        [a, b] = [b, a + b];                        // 往后挪一格：新的 b 是下一阶 //@step
    }
    return b;                                       //@done
};
