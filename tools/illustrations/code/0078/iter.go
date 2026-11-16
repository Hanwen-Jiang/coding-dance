func subsets(nums []int) [][]int {
	res := [][]int{{}} //@init
	for _, x := range nums {
		size := len(res)           // 只复制已有的子集 //@add
		for k := 0; k < size; k++ { //@add
			s := append(append([]int{}, res[k]...), x) //@add
			res = append(res, s)                       //@add
		}
	}
	return res //@done
}
