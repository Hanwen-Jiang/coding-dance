class Solution {
    public int[] maxSlidingWindow(int[] nums, int k) {
        Deque<Integer> q = new ArrayDeque<>();          // q 存下标，对应的值递减 //@init
        int[] res = new int[nums.length - k + 1];       //@init
        for (int i = 0; i < nums.length; i++) {
            while (!q.isEmpty() && nums[q.peekLast()] <= nums[i]) {    //@push
                q.pollLast();                           // 队尾比新数小，没用了 //@push
            }
            q.offerLast(i);                             //@push
            if (q.peekFirst() <= i - k) {               //@expire
                q.pollFirst();                          // 队头滑出窗口 //@expire
            }
            if (i >= k - 1) {                           //@record
                res[i - k + 1] = nums[q.peekFirst()];   //@record
            }
        }
        return res;                                     //@done
    }
}
