func reversePairs(record []int) int {
	tmp := make([]int, len(record))
	// 排好 record[l..r]，返回里面的逆序对数
	var sort func(l, r int) int
	sort = func(l, r int) int {
		if l >= r { //@base
			return 0 //@base
		}
		mid := l + (r-l)/2                 //@split
		cnt := sort(l, mid) + sort(mid+1, r) // 两半内部的逆序对 //@split
		i, j, k := l, mid+1, l             //@merge
		for i <= mid && j <= r {           //@merge
			if record[i] <= record[j] { //@take
				tmp[k] = record[i] //@take
				i++                //@take
			} else { // 右边的更小：左边剩下的都比它大 //@cross
				cnt += mid - i + 1 //@cross
				tmp[k] = record[j] //@cross
				j++                //@cross
			}
			k++ //@take,cross
		}
		for i <= mid { //@rest
			tmp[k] = record[i] //@rest
			i++                //@rest
			k++                //@rest
		}
		for j <= r { //@rest
			tmp[k] = record[j] //@rest
			j++                //@rest
			k++                //@rest
		}
		copy(record[l:r+1], tmp[l:r+1]) //@copy
		return cnt                      //@copy
	}
	return sort(0, len(record)-1) //@done
}
