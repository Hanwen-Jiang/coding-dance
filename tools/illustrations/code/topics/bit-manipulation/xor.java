class Solution {
    public int missingNumber(int[] nums) {
        int x = nums.length;                    // 0..n 里的 n 先放进来 //@init
        for (int i = 0; i < nums.length; i++) { //@loop
            x ^= i ^ nums[i];                   // 出现两次的数异或后抵消 //@xor
        }
        return x;                               //@done
    }
}
