function topKFrequent(nums: number[], k: number): number[] {
    const buckets: number[][] = Array.from({ length: nums.length + 1 }, () => []);     //@count
    const cnt = new Map<number, number>();                      //@count
    for (const x of nums) cnt.set(x, (cnt.get(x) ?? 0) + 1);    //@count
    for (const [x, c] of cnt) {                                 //@put
        buckets[c].push(x);                                     // 第 c 个桶放出现 c 次的数 //@put
    }
    const res: number[] = [];                                   //@scan
    for (let c = nums.length; c > 0; c--) {                     //@scan
        res.push(...buckets[c]);                                //@take
        if (res.length >= k) {                                  //@take
            return res.slice(0, k);                             //@done
        }
    }
    return res;
}
