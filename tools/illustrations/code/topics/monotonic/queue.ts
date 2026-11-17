function minSlidingWindow(nums: number[], k: number): number[] {
    const q: number[] = [];                         // 存下标，对应的值从队头到队尾递增 //@init
    let head = 0;                                   // 队头的位置，出队只要 head++ //@init
    const res: number[] = [];                       //@init
    nums.forEach((x, i) => {                        //@loop
        while (q.length > head && nums[q[q.length - 1]] >= x) {     // 比 x 大的以后不可能是最小值了 //@pop
            q.pop();                                //@pop
        }
        q.push(i);                                  //@push
        if (q[head] <= i - k) {                     // 队头滑出了窗口 //@expire
            head++;                                 //@expire
        }
        if (i >= k - 1) {                           // 窗口满了：队头就是最小值 //@record
            res.push(nums[q[head]]);                //@record
        }
    });
    return res;                                     //@done
}
