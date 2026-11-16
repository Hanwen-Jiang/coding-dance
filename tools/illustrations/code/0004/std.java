class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        if (nums1.length > nums2.length) {              //@init
            return findMedianSortedArrays(nums2, nums1);    // 保证在短的数组上二分 //@init
        }
        int m = nums1.length, n = nums2.length;         //@init
        int half = (m + n + 1) / 2;                     // 左半边一共要有多少个数 //@init
        int lo = 0, hi = m;                             //@init
        while (true) {                                  //@cut
            int i = (lo + hi) / 2;                      // nums1 左边取 i 个 //@cut
            int j = half - i;                           // nums2 左边取 j 个 //@cut
            int l1 = i > 0 ? nums1[i - 1] : Integer.MIN_VALUE;  //@cut
            int r1 = i < m ? nums1[i] : Integer.MAX_VALUE;      //@cut
            int l2 = j > 0 ? nums2[j - 1] : Integer.MIN_VALUE;  //@cut
            int r2 = j < n ? nums2[j] : Integer.MAX_VALUE;      //@cut
            if (l1 > r2) {                              //@right
                hi = i - 1;                             // nums1 切得太靠右 //@right
            } else if (l2 > r1) {                       //@left
                lo = i + 1;                             // nums1 切得太靠左 //@left
            } else {                                    //@found
                if ((m + n) % 2 == 1) {                 //@done
                    return Math.max(l1, l2);            //@done
                }
                return (Math.max(l1, l2) + (double) Math.min(r1, r2)) / 2;  //@done
            }
        }
    }
}
