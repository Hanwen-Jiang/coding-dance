function missingNumber(nums: number[]): number {
    let x = nums.length;                        // 0..n 里的 n 先放进来 //@init
    nums.forEach((v, i) => {                    //@loop
        x ^= i ^ v;                             // 出现两次的数异或后抵消 //@xor
    });
    return x;                                   //@done
}
