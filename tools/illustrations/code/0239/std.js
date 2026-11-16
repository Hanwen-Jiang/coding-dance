var maxSlidingWindow = function(nums, k) {
    const q = [], res = [];                     // q 存下标，对应的值递减；q[head] 是队头 //@init
    let head = 0;                               //@init
    for (let i = 0; i < nums.length; i++) {
        while (q.length > head && nums[q[q.length - 1]] <= nums[i]) {  //@push
            q.pop();                            // 队尾比新数小，没用了 //@push
        }
        q.push(i);                              //@push
        if (q[head] <= i - k) {                 //@expire
            head++;                             // 队头滑出窗口 //@expire
        }
        if (i >= k - 1) {                       //@record
            res.push(nums[q[head]]);            //@record
        }
    }
    return res;                                 //@done
};
