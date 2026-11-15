class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();   // 数值 -> 下标 //@init
        for (int i = 0; i < nums.length; i++) {
            if (seen.containsKey(target - nums[i])) {   // 先查 //@check
                return new int[]{seen.get(target - nums[i]), i};    //@found
            }
            seen.put(nums[i], i);                       // 再存 //@save
        }
        return new int[0];
    }
}
