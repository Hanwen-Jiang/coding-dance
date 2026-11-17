var sortArray = function(nums) {
    // 把 nums[l..r] 排好
    const quick = (l, r) => {
        if (l >= r) {                           // 只剩 0 或 1 个数 //@base
            return;                             //@base
        }
        const pivot = nums[(l + r) >> 1];       // 取中间的数当基准 //@pivot
        let i = l - 1, j = r + 1;               //@pivot
        while (i < j) {
            i++;                                //@scan
            while (nums[i] < pivot) {           // 左边找一个 >= pivot 的 //@scan
                i++;                            //@scan
            }
            j--;                                //@scan
            while (nums[j] > pivot) {           // 右边找一个 <= pivot 的 //@scan
                j--;                            //@scan
            }
            if (i < j) {                        //@swap
                [nums[i], nums[j]] = [nums[j], nums[i]];    // 交换以后两边都对了 //@swap
            }
        }
        quick(l, j);                            // [l, j] 都 <= pivot //@recur
        quick(j + 1, r);                        // [j+1, r] 都 >= pivot //@recur
    };
    quick(0, nums.length - 1);                  //@start
    return nums;                                //@done
};
