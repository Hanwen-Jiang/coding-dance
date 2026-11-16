class Solution {
    public int longestConsecutive(int[] nums) {
        Map<Integer, Integer> lens = new HashMap<>();   //@init
        int best = 0;                                   //@init
        for (int x : nums) {
            if (!lens.containsKey(x)) {                 //@dup
                int l = lens.getOrDefault(x - 1, 0), r = lens.getOrDefault(x + 1, 0);  //@join
                int len = l + r + 1;                    //@join
                lens.put(x, len);                       //@join
                lens.put(x - l, len);                   // 只更新新段的两个端点 //@join
                lens.put(x + r, len);                   //@join
                best = Math.max(best, len);             //@join
            }
        }
        return best;                                    //@done
    }
}
