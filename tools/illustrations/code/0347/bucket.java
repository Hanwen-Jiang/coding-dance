class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        List<List<Integer>> buckets = new ArrayList<>();            //@count
        for (int i = 0; i <= nums.length; i++) buckets.add(new ArrayList<>());   //@count
        Map<Integer, Integer> cnt = new HashMap<>();                //@count
        for (int x : nums) cnt.merge(x, 1, Integer::sum);           //@count
        for (Map.Entry<Integer, Integer> e : cnt.entrySet()) {      //@put
            buckets.get(e.getValue()).add(e.getKey());              // 第 c 个桶放出现 c 次的数 //@put
        }
        int[] res = new int[k];                                     //@scan
        int got = 0;                                                //@scan
        for (int c = nums.length; c > 0; c--) {                     //@scan
            for (int x : buckets.get(c)) {                          //@take
                res[got++] = x;                                     //@take
                if (got == k) {                                     //@take
                    return res;                                     //@done
                }
            }
        }
        return res;
    }
}
