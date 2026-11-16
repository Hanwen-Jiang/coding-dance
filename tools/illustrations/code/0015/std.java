class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        Arrays.sort(nums);                                  //@sort
        int n = nums.length;                                //@sort
        List<List<Integer>> res = new ArrayList<>();        //@sort
        for (int i = 0; i < n - 2; i++) {
            if (nums[i] > 0) {                              //@stop
                break;                                      // 最小的都大于 0，后面不可能了 //@stop
            }
            if (i > 0 && nums[i] == nums[i - 1]) {          //@skip
                continue;                                   // 第一个数去重 //@skip
            }
            int l = i + 1, r = n - 1;                       //@fix
            while (l < r) {
                int s = nums[i] + nums[l] + nums[r];        //@small,big,found
                if (s < 0) {                                //@small
                    l++;                                    //@small
                } else if (s > 0) {                         //@big
                    r--;                                    //@big
                } else {
                    res.add(Arrays.asList(nums[i], nums[l], nums[r]));  //@found
                    l++;                                    //@found
                    r--;                                    //@found
                    while (l < r && nums[l] == nums[l - 1]) {   //@found
                        l++;                                // 第二个数去重 //@found
                    }
                    while (l < r && nums[r] == nums[r + 1]) {   //@found
                        r--;                                // 第三个数去重 //@found
                    }
                }
            }
        }
        return res;                                         //@done
    }
}
