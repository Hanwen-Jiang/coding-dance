class Solution {
    public int[] intersection(int[] nums1, int[] nums2) {
        Set<Integer> seen = new HashSet<>();        // 查一个数在不在：O(1) //@init
        for (int x : nums1) {                       //@init
            seen.add(x);                            //@init
        }
        Set<Integer> res = new HashSet<>();         // 答案也用集合，自动去重 //@init
        for (int x : nums2) {                       //@loop
            if (seen.contains(x)) {                 //@hit
                res.add(x);                         //@hit
            }
        }
        int[] ans = new int[res.size()];            //@done
        int k = 0;                                  //@done
        for (int x : res) {                         //@done
            ans[k++] = x;                           //@done
        }
        return ans;                                 //@done
    }
}
