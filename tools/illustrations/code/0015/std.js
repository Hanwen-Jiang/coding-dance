var threeSum = function(nums) {
    nums.sort((a, b) => a - b);                         //@sort
    const n = nums.length, res = [];                    //@sort
    for (let i = 0; i < n - 2; i++) {
        if (nums[i] > 0) {                              //@stop
            break;                                      // 最小的都大于 0，后面不可能了 //@stop
        }
        if (i > 0 && nums[i] === nums[i - 1]) {         //@skip
            continue;                                   // 第一个数去重 //@skip
        }
        let l = i + 1, r = n - 1;                       //@fix
        while (l < r) {
            const s = nums[i] + nums[l] + nums[r];      //@small,big,found
            if (s < 0) {                                //@small
                l++;                                    //@small
            } else if (s > 0) {                         //@big
                r--;                                    //@big
            } else {
                res.push([nums[i], nums[l], nums[r]]);  //@found
                l++;                                    //@found
                r--;                                    //@found
                while (l < r && nums[l] === nums[l - 1]) {  //@found
                    l++;                                // 第二个数去重 //@found
                }
                while (l < r && nums[r] === nums[r + 1]) {  //@found
                    r--;                                // 第三个数去重 //@found
                }
            }
        }
    }
    return res;                                         //@done
};
