var subsets = function(nums) {
    let res = [[]];                                 //@init
    for (const x of nums) {
        res = res.concat(res.map((s) => [...s, x]));    // 已有的每个子集都加上 x //@add
    }
    return res;                                     //@done
};
