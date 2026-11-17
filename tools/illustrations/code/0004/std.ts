function findMedianSortedArrays(nums1: number[], nums2: number[]): number {
    if (nums1.length > nums2.length) {              //@init
        [nums1, nums2] = [nums2, nums1];            // 保证在短的数组上二分 //@init
    }
    const m = nums1.length, n = nums2.length;       //@init
    const half = (m + n + 1) >> 1;                  // 左半边一共要有多少个数 //@init
    let lo = 0, hi = m;                             //@init
    while (true) {                                  //@cut
        const i = (lo + hi) >> 1;                   // nums1 左边取 i 个 //@cut
        const j = half - i;                         // nums2 左边取 j 个 //@cut
        const l1 = i > 0 ? nums1[i - 1] : -Infinity;    //@cut
        const r1 = i < m ? nums1[i] : Infinity;     //@cut
        const l2 = j > 0 ? nums2[j - 1] : -Infinity;    //@cut
        const r2 = j < n ? nums2[j] : Infinity;     //@cut
        if (l1 > r2) {                              //@right
            hi = i - 1;                             // nums1 切得太靠右 //@right
        } else if (l2 > r1) {                       //@left
            lo = i + 1;                             // nums1 切得太靠左 //@left
        } else {                                    //@found
            if ((m + n) % 2 === 1) {                //@done
                return Math.max(l1, l2);            //@done
            }
            return (Math.max(l1, l2) + Math.min(r1, r2)) / 2;   //@done
        }
    }
}
