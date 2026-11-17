var productExceptSelf = function(nums) {
    const n = nums.length;                      //@init
    const answer = new Array(n).fill(1);        //@init
    for (let i = 1; i < n; i++) {               // answer[i] = 左边所有数的乘积 //@left
        answer[i] = answer[i - 1] * nums[i - 1];    //@left
    }
    let right = 1;                              // 右边所有数的乘积 //@right
    for (let i = n - 1; i >= 0; i--) {          //@right
        answer[i] *= right;                     //@right
        right *= nums[i];                       //@right
    }
    return answer;                              //@done
};
