class Solution {
    public int[] productExceptSelf(int[] nums) {
        int n = nums.length;                        //@init
        int[] answer = new int[n];                  //@init
        answer[0] = 1;                              //@init
        for (int i = 1; i < n; i++) {               // answer[i] = 左边所有数的乘积 //@left
            answer[i] = answer[i - 1] * nums[i - 1];    //@left
        }
        int right = 1;                              // 右边所有数的乘积 //@right
        for (int i = n - 1; i >= 0; i--) {          //@right
            answer[i] *= right;                     //@right
            right *= nums[i];                       //@right
        }
        return answer;                              //@done
    }
}
