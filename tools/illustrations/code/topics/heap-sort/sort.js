var sortArray = function(nums) {
    // 在 nums[0..n-1] 这个最大堆里让 nums[i] 下沉
    const siftDown = (i, n) => {
        while (true) {
            let big = i;
            const l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && nums[l] > nums[big]) big = l;
            if (r < n && nums[r] > nums[big]) big = r;
            if (big === i) return;
            [nums[i], nums[big]] = [nums[big], nums[i]];
            i = big;
        }
    };
    const n = nums.length;
    for (let i = (n >> 1) - 1; i >= 0; i--) {   // 建最大堆：从最后一个非叶子往前下沉 //@build
        siftDown(i, n);                         //@build
    }
    for (let end = n - 1; end > 0; end--) {     //@pick
        [nums[0], nums[end]] = [nums[end], nums[0]];    // 堆顶（最大）换到末尾 //@pick
        siftDown(0, end);                       // 剩下的 end 个数重新调成堆 //@fix
    }
    return nums;                                //@done
};
