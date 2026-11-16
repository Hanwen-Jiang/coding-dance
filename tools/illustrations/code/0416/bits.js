var canPartition = function(nums) {
    let total = 0, bits = 1n;                   // 第 j 位是 1：能凑出和 j //@init
    for (const x of nums) {                     //@add
        total += x;                             //@add
        bits |= bits << BigInt(x);              //@add
    }
    return total % 2 === 0 && ((bits >> BigInt(total / 2)) & 1n) === 1n;  //@done
};
