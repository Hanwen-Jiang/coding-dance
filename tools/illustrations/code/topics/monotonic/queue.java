class Solution {
    public int[] minSlidingWindow(int[] nums, int k) {
        Deque<Integer> q = new ArrayDeque<>();          // 存下标，对应的值从队头到队尾递增 //@init
        int[] res = new int[nums.length - k + 1];       //@init
        for (int i = 0; i < nums.length; i++) {         //@loop
            while (!q.isEmpty() && nums[q.peekLast()] >= nums[i]) {     // 比 nums[i] 大的以后不可能是最小值了 //@pop
                q.pollLast();                           //@pop
            }
            q.offerLast(i);                             //@push
            if (q.peekFirst() <= i - k) {               // 队头滑出了窗口 //@expire
                q.pollFirst();                          //@expire
            }
            if (i >= k - 1) {                           // 窗口满了：队头就是最小值 //@record
                res[i - k + 1] = nums[q.peekFirst()];   //@record
            }
        }
        return res;                                     //@done
    }
}
