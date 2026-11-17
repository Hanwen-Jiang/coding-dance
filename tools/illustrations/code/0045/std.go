func jump(nums []int) int {
	jumps, end, far := 0, 0, 0         // end：当前这一跳能到的右端 //@init
	for i := 0; i < len(nums)-1; i++ { // 最后一个位置不用再跳
		far = max(far, i+nums[i]) //@far,edge
		if i == end {             // 这一层走完了，必须再跳一次 //@far,edge
			jumps++   //@jump
			end = far //@jump
		}
	}
	return jumps //@done
}
