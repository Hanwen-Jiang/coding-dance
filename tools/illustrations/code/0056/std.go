func merge(intervals [][]int) [][]int {
	sort.Slice(intervals, func(i, j int) bool { return intervals[i][0] < intervals[j][0] }) // 先按起点排 //@sort
	res := [][]int{}                                                                        //@sort
	for _, cur := range intervals {
		a, b := cur[0], cur[1]
		if len(res) > 0 && a <= res[len(res)-1][1] { //@merge
			last := res[len(res)-1]   //@merge
			last[1] = max(last[1], b) // 重叠，延长终点 //@merge
		} else {
			res = append(res, []int{a, b}) // 不重叠，另起一段 //@new
		}
	}
	return res //@done
}
