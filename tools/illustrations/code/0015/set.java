class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        Arrays.sort(nums);                                  //@sort
        Set<List<Integer>> res = new HashSet<>();           //@sort
        for (int i = 0; i < nums.length; i++) {
            int x = nums[i];
            if (i > 0 && x == nums[i - 1]) {                //@skip
                continue;                                   //@skip
            }
            Set<Integer> seen = new HashSet<>();            //@fix
            for (int j = i + 1; j < nums.length; j++) {
                int y = nums[j];
                if (seen.contains(-x - y)) {                //@found,miss
                    res.add(Arrays.asList(x, -x - y, y));   //@found
                }
                seen.add(y);                                //@miss
            }
        }
        List<List<Integer>> out = new ArrayList<>(res);     //@done
        out.sort((a, b) -> !a.get(0).equals(b.get(0)) ? a.get(0) - b.get(0) : !a.get(1).equals(b.get(1)) ? a.get(1) - b.get(1) : a.get(2) - b.get(2));    //@done
        return out;                                         //@done
    }
}
