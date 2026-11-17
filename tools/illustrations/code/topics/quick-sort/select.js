var findKthLargest = function(nums, k) {
    const target = nums.length - k;         // 第 k 大 = 从小到大排好后下标 n-k 的数 //@init
    let l = 0, r = nums.length - 1;         //@init
    while (l < r) {
        const pivot = nums[(l + r) >> 1];   //@pivot
        let i = l - 1, j = r + 1;           //@pivot
        while (i < j) {
            i++;                            //@scan
            while (nums[i] < pivot) {       //@scan
                i++;                        //@scan
            }
            j--;                            //@scan
            while (nums[j] > pivot) {       //@scan
                j--;                        //@scan
            }
            if (i < j) {                    //@swap
                [nums[i], nums[j]] = [nums[j], nums[i]];    //@swap
            }
        }
        if (target <= j) {                  // 答案在左边一段 //@go
            r = j;                          //@go
        } else {                            // 答案在右边一段 //@go
            l = j + 1;                      //@go
        }
    }
    return nums[l];                         //@done
};
