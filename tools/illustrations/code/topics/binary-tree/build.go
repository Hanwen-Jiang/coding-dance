/**
 * 力扣已经定义好了 TreeNode：
 * type TreeNode struct {
 *     Val   int
 *     Left  *TreeNode
 *     Right *TreeNode
 * }
 */
func buildTree(data string) *TreeNode {
	var vals []string // "1,2,null" -> ["1", "2", "null"] //@init
	if data != "" {   //@init
		vals = strings.Split(data, ",") //@init
	}
	if len(vals) == 0 || vals[0] == "null" { //@init
		return nil //@init
	}
	v, _ := strconv.Atoi(vals[0]) //@root
	root := &TreeNode{Val: v}     //@root
	q := []*TreeNode{root}        // 还没接孩子的节点 //@root
	i := 1
	for len(q) > 0 && i < len(vals) { //@take
		node := q[0] // 给它接左、右孩子 //@take
		q = q[1:]    //@take
		if vals[i] != "null" { //@left
			v, _ := strconv.Atoi(vals[i]) //@left
			node.Left = &TreeNode{Val: v} //@left
			q = append(q, node.Left)      //@left
		}
		i++ //@left
		if i < len(vals) && vals[i] != "null" { //@right
			v, _ := strconv.Atoi(vals[i])  //@right
			node.Right = &TreeNode{Val: v} //@right
			q = append(q, node.Right)      //@right
		}
		i++ //@right
	}
	return root //@done
}
