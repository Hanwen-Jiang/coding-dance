class KthLargest {
    private final int k;
    private final PriorityQueue<Integer> heap = new PriorityQueue<>();  // 最小堆，只留最大的 k 个数 //@init

    public KthLargest(int k, int[] nums) {
        this.k = k;
        for (int x : nums) {                    //@init
            add(x);                             //@init
        }
    }

    public int add(int val) {
        heap.offer(val);                        //@push
        if (heap.size() > k) {                  // 多了一个：最小的那个不可能是前 k 大 //@trim
            heap.poll();                        //@trim
        }
        return heap.peek();                     // 堆顶就是第 k 大 //@top
    }
}
