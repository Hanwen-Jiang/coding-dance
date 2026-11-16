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

// 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
var judgeNodes []*ListNode
var judgeLastTree *TreeNode

func judgeReset() {
	judgeNodes = nil
	judgeLastTree = nil
}

func judgeList(vals []int) *ListNode {
	dummy := &ListNode{}
	cur := dummy
	for _, v := range vals {
		cur.Next = &ListNode{Val: v}
		cur = cur.Next
		judgeNodes = append(judgeNodes, cur)
	}
	return dummy.Next
}

// 最后一个节点接回下标 pos 的节点（-1 不成环）
func judgeCycle(vals []int, pos int) *ListNode {
	s := len(judgeNodes)
	head := judgeList(vals)
	if pos >= 0 && len(vals) > 0 {
		judgeNodes[s+len(vals)-1].Next = judgeNodes[s+pos]
	}
	return head
}

// 独有部分后面接上本用例建出的第 k 个节点（-1 不接）
func judgeJoin(vals []int, k int) *ListNode {
	var tail *ListNode
	if k >= 0 {
		tail = judgeNodes[k]
	}
	s := len(judgeNodes)
	head := judgeList(vals)
	if len(vals) == 0 {
		return tail
	}
	judgeNodes[s+len(vals)-1].Next = tail
	return head
}

func judgeIndex(n *ListNode) any {
	if n == nil {
		return nil
	}
	for i, x := range judgeNodes {
		if x == n {
			return i
		}
	}
	return "不是输入里的节点"
}

func judgeFind(v int) *TreeNode {
	st := []*TreeNode{judgeLastTree}
	for len(st) > 0 {
		t := st[len(st)-1]
		st = st[:len(st)-1]
		if t == nil {
			continue
		}
		if t.Val == v {
			return t
		}
		st = append(st, t.Left, t.Right)
	}
	return nil
}

func judgeVal(n *TreeNode) any {
	if n == nil {
		return nil
	}
	return n.Val
}

func judgeListVals(head *ListNode) []int {
	out := []int{}
	for n := 0; head != nil && n < 100000; n++ {
		out = append(out, head.Val)
		head = head.Next
	}
	return out
}

func judgeTree(vals []any) *TreeNode {
	judgeLastTree = judgeTreeOf(vals)
	return judgeLastTree
}

// 层序数组，nil 表示空位
func judgeTreeOf(vals []any) *TreeNode {
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
