class Solution {
    public int lengthOfLIS(int[] nums) {
        List<Integer> tails = new ArrayList<>();        // tails[k]：长度 k+1 的递增子序列的最小结尾 //@init
        for (int x : nums) {
            int lo = 0, hi = tails.size();              // 二分找第一个 >= x 的位置 //@add,rep
            while (lo < hi) {                           //@add,rep
                int mid = (lo + hi) / 2;                //@add,rep
                if (tails.get(mid) < x) lo = mid + 1;   //@add,rep
                else hi = mid;                          //@add,rep
            }
            if (lo == tails.size()) tails.add(x);       // 比所有结尾都大，接在最后 //@add
            else tails.set(lo, x);                      // 换成更小的结尾 //@rep
        }
        return tails.size();                            //@done
    }
}
