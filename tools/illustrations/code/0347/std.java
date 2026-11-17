class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> cnt = new HashMap<>();                //@count
        for (int x : nums) cnt.merge(x, 1, Integer::sum);           //@count
        PriorityQueue<int[]> heap = new PriorityQueue<>((p, q) -> p[0] - q[0]);   // 小顶堆，只留次数最多的 k 个 //@count
        for (Map.Entry<Integer, Integer> e : cnt.entrySet()) {
            heap.offer(new int[]{e.getValue(), e.getKey()});        //@push,pop
            if (heap.size() > k) {                                  //@push,pop
                heap.poll();                                        // 挤掉次数最少的 //@pop
            }
        }
        int[] res = new int[k];                                     //@done
        for (int i = 0; i < k; i++) res[i] = heap.poll()[1];        //@done
        return res;                                                 //@done
    }
}
