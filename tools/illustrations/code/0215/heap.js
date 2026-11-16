var findKthLargest = function(nums, k) {
    const heap = [];                                // 小顶堆，最多 k 个
    const up = (i) => {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heap[p] <= heap[i]) break;
            [heap[p], heap[i]] = [heap[i], heap[p]];
            i = p;
        }
    };
    const down = (i) => {
        while (true) {
            const l = 2 * i + 1, r = l + 1;
            let s = i;
            if (l < heap.length && heap[l] < heap[s]) s = l;
            if (r < heap.length && heap[r] < heap[s]) s = r;
            if (s === i) break;
            [heap[s], heap[i]] = [heap[i], heap[s]];
            i = s;
        }
    };
    for (let i = 0; i < k; i++) {                   // 先放前 k 个 //@push
        heap.push(nums[i]);                         //@push
        up(heap.length - 1);                        //@push
    }
    for (let i = k; i < nums.length; i++) {
        if (nums[i] > heap[0]) {                    // 比堆顶大，才有资格进前 k //@replace,skip
            heap[0] = nums[i];                      //@replace
            down(0);                                //@replace
        }
    }
    return heap[0];                                 //@done
};
