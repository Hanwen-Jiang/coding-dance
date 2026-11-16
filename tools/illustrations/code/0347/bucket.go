func topKFrequent(nums []int, k int) []int {
	buckets := make([][]int, len(nums)+1) //@count
	cnt := map[int]int{}                  //@count
	for _, x := range nums {              //@count
		cnt[x]++ //@count
	}
	for x, c := range cnt { //@put
		buckets[c] = append(buckets[c], x) // 第 c 个桶放出现 c 次的数 //@put
	}
	res := []int{}                   //@scan
	for c := len(nums); c > 0; c-- { //@scan
		res = append(res, buckets[c]...) //@take
		if len(res) >= k {               //@take
			return res[:k] //@done
		}
	}
	return res
}
