function threeSum(nums: number[]): number[][] {
    nums.sort((a, b) => a - b);                         //@sort
    const res = new Map<string, number[]>();            // 用 "x,y,z" 做键去重 //@sort
    for (let i = 0; i < nums.length; i++) {
        const x = nums[i];
        if (i > 0 && x === nums[i - 1]) {               //@skip
            continue;                                   //@skip
        }
        const seen = new Set<number>();                 //@fix
        for (let j = i + 1; j < nums.length; j++) {
            const y = nums[j];
            if (seen.has(-x - y)) {                     //@found,miss
                res.set(`${x},${-x - y},${y}`, [x, -x - y, y]);     //@found
            }
            seen.add(y);                                //@miss
        }
    }
    return [...res.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);    //@done
}
