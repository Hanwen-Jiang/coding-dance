function jump(nums: number[]): number {
    let jumps = 0, end = 0, far = 0;            // end：当前这一跳能到的右端 //@init
    for (let i = 0; i < nums.length - 1; i++) { // 最后一个位置不用再跳
        far = Math.max(far, i + nums[i]);       //@far,edge
        if (i === end) {                        // 这一层走完了，必须再跳一次 //@far,edge
            jumps++;                            //@jump
            end = far;                          //@jump
        }
    }
    return jumps;                               //@done
}
