class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Integer> s = new HashSet<>();           //@init
        for (int x : nums) s.add(x);                //@init
        int best = 0;                               //@init
        for (int x : s) {                           // 遍历集合，不是遍历 nums
            if (s.contains(x - 1)) {                //@skip
                continue;                           // 不是起点，跳过 //@skip
            }
            int y = x;                              //@start
            while (s.contains(y + 1)) {             //@count
                y++;                                //@count
            }
            best = Math.max(best, y - x + 1);       //@best
        }
        return best;                                //@done
    }
}
