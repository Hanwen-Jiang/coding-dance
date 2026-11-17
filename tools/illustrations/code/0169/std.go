func majorityElement(nums []int) int {
	cand, count := 0, 0 //@init
	for _, x := range nums {
		if count == 0 { //@new
			cand = x // 票数归零，换候选人 //@new
		}
		if x == cand { // 相同 +1，不同就抵消一票 //@vote,new
			count++ //@vote,new
		} else { //@vote
			count-- //@vote
		}
	}
	return cand //@done
}
