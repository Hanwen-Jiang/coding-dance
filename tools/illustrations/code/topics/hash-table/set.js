var intersection = function(nums1, nums2) {
    const seen = new Set(nums1);                // 查一个数在不在：O(1) //@init
    const res = new Set();                      // 答案也用集合，自动去重 //@init
    for (const x of nums2) {                    //@loop
        if (seen.has(x)) {                      //@hit
            res.add(x);                         //@hit
        }
    }
    return [...res];                            //@done
};
