function lengthOfLIS(nums: number[]): number {
    const tails: number[] = [];                     // tails[k]：长度 k+1 的递增子序列的最小结尾 //@init
    for (const x of nums) {
        let lo = 0, hi = tails.length;              // 二分找第一个 >= x 的位置 //@add,rep
        while (lo < hi) {                           //@add,rep
            const mid = (lo + hi) >> 1;             //@add,rep
            if (tails[mid] < x) lo = mid + 1;       //@add,rep
            else hi = mid;                          //@add,rep
        }
        tails[lo] = x;                              // lo 等于长度时是接在最后，否则是替换 //@add,rep
    }
    return tails.length;                            //@done
}
