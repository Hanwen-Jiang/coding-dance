package main

// 力扣 Go 环境里现成的两个节点类型
type ListNode struct {
	Val  int
	Next *ListNode
}

type TreeNode struct {
	Val   int
	Left  *TreeNode
	Right *TreeNode
}

func judgeList(vals []int) *ListNode {
	dummy := &ListNode{}
	cur := dummy
	for _, v := range vals {
		cur.Next = &ListNode{Val: v}
		cur = cur.Next
	}
	return dummy.Next
}

func judgeListVals(head *ListNode) []int {
	out := []int{}
	for n := 0; head != nil && n < 100000; n++ {
		out = append(out, head.Val)
		head = head.Next
	}
	return out
}

// 层序数组，nil 表示空位
func judgeTree(vals []any) *TreeNode {
	if len(vals) == 0 || vals[0] == nil {
		return nil
	}
	root := &TreeNode{Val: vals[0].(int)}
	q := []*TreeNode{root}
	i := 1
	for h := 0; i < len(vals) && h < len(q); h++ {
		node := q[h]
		if vals[i] != nil {
			node.Left = &TreeNode{Val: vals[i].(int)}
			q = append(q, node.Left)
		}
		i++
		if i < len(vals) {
			if vals[i] != nil {
				node.Right = &TreeNode{Val: vals[i].(int)}
				q = append(q, node.Right)
			}
			i++
		}
	}
	return root
}

func judgeTreeVals(root *TreeNode) []any {
	out := []any{}
	q := []*TreeNode{root}
	for h := 0; h < len(q); h++ {
		n := q[h]
		if n == nil {
			out = append(out, nil)
			continue
		}
		out = append(out, n.Val)
		q = append(q, n.Left, n.Right)
	}
	for len(out) > 0 && out[len(out)-1] == nil {
		out = out[:len(out)-1]
	}
	return out
}

func judgeBytes(b []byte) []string {
	out := []string{}
	for _, c := range b {
		out = append(out, string(rune(c)))
	}
	return out
}

func judgeBytes2(g [][]byte) [][]string {
	out := [][]string{}
	for _, row := range g {
		out = append(out, judgeBytes(row))
	}
	return out
}
