class Solution {
    public int minEatingSpeed(int[] piles, int h) {
        int lo = 1, hi = Arrays.stream(piles).max().getAsInt();    // 答案一定在 [lo, hi] 里 //@init
        while (lo < hi) {                       //@loop
            int mid = lo + (hi - lo) / 2;       //@mid
            if (hours(piles, mid) <= h) {       // 吃得完：答案是 mid 或更小 //@ok
                hi = mid;                       //@ok
            } else {                            // 吃不完：要更快 //@slow
                lo = mid + 1;                   //@slow
            }
        }
        return lo;                              //@done
    }

    // 速度为 k 时要吃几小时；总数可能超过 int，用 long
    private long hours(int[] piles, int k) {
        long total = 0;
        for (int p : piles) {
            total += (p + k - 1) / k;           //@check
        }
        return total;
    }
}
