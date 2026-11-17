function subarraySum(nums: number[], k: number): number {
    const count = new Map<number, number>([[0, 1]]);    // 空前缀 //@init
    let pre = 0, res = 0;                           //@init
    for (const x of nums) {                         //@query
        pre += x;                                   //@query
        res += count.get(pre - k) ?? 0;             // 先查 //@query
        count.set(pre, (count.get(pre) ?? 0) + 1);  // 再存 //@store
    }
    return res;                                     //@done
}
