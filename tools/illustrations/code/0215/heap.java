class Solution {
    public int findKthLargest(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>();    // 小顶堆 //@push
        for (int i = 0; i < k; i++) heap.offer(nums[i]);       // 先放前 k 个 //@push
        for (int i = k; i < nums.length; i++) {
            if (nums[i] > heap.peek()) {                        // 比堆顶大，才有资格进前 k //@replace,skip
                heap.poll();                                    //@replace
                heap.offer(nums[i]);                            //@replace
            }
        }
        return heap.peek();                                     //@done
    }
}
