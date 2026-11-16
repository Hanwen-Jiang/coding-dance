var rob = function(nums) {
    let prev = 0, cur = 0;                          // dp[-1]（越界）和 dp[0]（没有房子），都是 0 //@init
    for (const x of nums) {                         //@step
        [prev, cur] = [cur, Math.max(cur, prev + x)];   // 不偷：cur；偷：prev + x //@step
    }
    return cur;                                     //@done
};
