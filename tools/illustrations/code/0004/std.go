func findMedianSortedArrays(nums1 []int, nums2 []int) float64 {
	if len(nums1) > len(nums2) { //@init
		nums1, nums2 = nums2, nums1 // 保证在短的数组上二分 //@init
	}
	m, n := len(nums1), len(nums2) //@init
	half := (m + n + 1) / 2        // 左半边一共要有多少个数 //@init
	lo, hi := 0, m                 //@init
	for { //@cut
		i := (lo + hi) / 2 // nums1 左边取 i 个 //@cut
		j := half - i      // nums2 左边取 j 个 //@cut
		l1, r1, l2, r2 := math.MinInt, math.MaxInt, math.MinInt, math.MaxInt //@cut
		if i > 0 { //@cut
			l1 = nums1[i-1] //@cut
		}
		if i < m { //@cut
			r1 = nums1[i] //@cut
		}
		if j > 0 { //@cut
			l2 = nums2[j-1] //@cut
		}
		if j < n { //@cut
			r2 = nums2[j] //@cut
		}
		if l1 > r2 { //@right
			hi = i - 1 // nums1 切得太靠右 //@right
		} else if l2 > r1 { //@left
			lo = i + 1 // nums1 切得太靠左 //@left
		} else { //@found
			if (m+n)%2 == 1 { //@done
				return float64(max(l1, l2)) //@done
			}
			return float64(max(l1, l2)+min(r1, r2)) / 2 //@done
		}
	}
}
