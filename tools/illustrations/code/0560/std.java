class Solution {
    public int subarraySum(int[] nums, int k) {
        Map<Integer, Integer> count = new HashMap<>();  //@init
        count.put(0, 1);                                // 空前缀 //@init
        int pre = 0, res = 0;                           //@init
        for (int x : nums) {                            //@query
            pre += x;                                   //@query
            res += count.getOrDefault(pre - k, 0);      // 先查 //@query
            count.merge(pre, 1, Integer::sum);          // 再存 //@store
        }
        return res;                                     //@done
    }
}
