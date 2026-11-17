class Solution {
    // 速度为 k 时要吃几小时；总数可能超过 int，用 long long
    long long hours(vector<int>& piles, int k) {
        long long total = 0;
        for (int p : piles) {
            total += (p + (long long)k - 1) / k;    //@check
        }
        return total;
    }

public:
    int minEatingSpeed(vector<int>& piles, int h) {
        int lo = 1, hi = *max_element(piles.begin(), piles.end());  // 答案一定在 [lo, hi] 里 //@init
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
};
