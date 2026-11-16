func productExceptSelf(nums []int) []int {
	n := len(nums)          //@init
	answer := make([]int, n) //@init
	answer[0] = 1           //@init
	for i := 1; i < n; i++ { // answer[i] = 左边所有数的乘积 //@left
		answer[i] = answer[i-1] * nums[i-1] //@left
	}
	right := 1                   // 右边所有数的乘积 //@right
	for i := n - 1; i >= 0; i-- { //@right
		answer[i] *= right //@right
		right *= nums[i]   //@right
	}
	return answer //@done
}
