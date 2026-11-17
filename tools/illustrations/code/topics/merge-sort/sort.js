var sortArray = function(nums) {
    const tmp = new Array(nums.length);
    // 把 nums[l..r] 排好
    const mergeSort = (l, r) => {
        if (l >= r) {                           //@base
            return;                             //@base
        }
        const mid = (l + r) >> 1;               //@split
        mergeSort(l, mid);                      // 先把两半各自排好 //@split
        mergeSort(mid + 1, r);                  //@split
        let i = l, j = mid + 1, k = l;          // 合并两个有序的半段 //@merge
        while (i <= mid && j <= r) {            //@merge
            if (nums[i] <= nums[j]) {           // 相等时先拿左边的：稳定 //@take
                tmp[k++] = nums[i++];           //@take
            } else {                            //@take
                tmp[k++] = nums[j++];           //@take
            }
        }
        while (i <= mid) {                      // 一边用完了，另一边剩下的直接接上 //@rest
            tmp[k++] = nums[i++];               //@rest
        }
        while (j <= r) {                        //@rest
            tmp[k++] = nums[j++];               //@rest
        }
        for (let x = l; x <= r; x++) {          // 拷回原数组 //@copy
            nums[x] = tmp[x];                   //@copy
        }
    };
    mergeSort(0, nums.length - 1);              //@start
    return nums;                                //@done
};
