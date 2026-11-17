class Solution {
    public int minSubArrayLen(int target, int[] nums) {
        int left = 0, total = 0;                        //@init
        int best = nums.length + 1;                     // 比任何窗口都长：表示还没找到 //@init
        for (int right = 0; right < nums.length; right++) { //@grow
            total += nums[right];                       // 右端进一个数 //@grow
            while (total >= target) {                   // 够了：记下长度，再试着缩短 //@shrink
                best = Math.min(best, right - left + 1);    //@shrink
                total -= nums[left];                    // 左端出一个数 //@shrink
                left++;                                 //@shrink
            }
        }
        return best <= nums.length ? best : 0;          //@done
    }
}
