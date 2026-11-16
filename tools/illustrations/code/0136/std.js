var singleNumber = function(nums) {
    let res = 0;                        //@init
    for (const x of nums) {             //@xor
        res ^= x;                       // 成对的数会互相抵消 //@xor
    }
    return res;                         //@done
};
