class MedianFinder {
    private PriorityQueue<Integer> lo, hi;

    public MedianFinder() {
        lo = new PriorityQueue<>(Collections.reverseOrder());   // 大顶堆，较小的一半 //@init
        hi = new PriorityQueue<>();                     // 小顶堆，较大的一半 //@init
    }

    public void addNum(int num) {
        lo.offer(num);                                  //@add
        hi.offer(lo.poll());                            // lo 的最大值挪到 hi //@add
        if (hi.size() > lo.size()) {                    // 保持 lo 不比 hi 少 //@add,rebal
            lo.offer(hi.poll());                        //@rebal
        }
    }

    public double findMedian() {
        if (lo.size() > hi.size()) {                    //@odd,even
            return lo.peek();                           //@odd
        }
        return (lo.peek() + hi.peek()) / 2.0;           //@even
    }
}
