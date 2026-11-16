func copyRandomList(head *Node) *Node {
	if head == nil {
		return nil
	}
	m := map[*Node]*Node{} // 旧节点 -> 新节点；查不到（比如 nil）得到的就是 nil //@init
	cur := head            //@init
	for cur != nil { // 第一遍：只造节点 //@make
		m[cur] = &Node{Val: cur.Val} //@make
		cur = cur.Next               //@make
	}
	cur = head //@link
	for cur != nil { // 第二遍：连指针 //@link
		m[cur].Next = m[cur.Next]     //@link
		m[cur].Random = m[cur.Random] //@link
		cur = cur.Next                //@link
	}
	return m[head] //@done
}
