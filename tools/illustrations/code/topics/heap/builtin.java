class Solution {
    public int lastStoneWeight(int[] stones) {
        PriorityQueue<Integer> heap = new PriorityQueue<>((a, b) -> b - a);    // 传比较器变成最大堆 //@init
        for (int x : stones) {                      //@init
            heap.offer(x);                          //@init
        }
        while (heap.size() > 1) {                   //@loop
            int y = heap.poll();                    // 最重的 //@pop
            int x = heap.poll();                    // 第二重的 //@pop
            if (x != y) {                           //@push
                heap.offer(y - x);                  // 碎了还剩 y - x //@push
            }
        }
        return heap.isEmpty() ? 0 : heap.peek();    //@done
    }
}
