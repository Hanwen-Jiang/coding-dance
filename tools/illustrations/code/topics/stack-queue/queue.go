type MyQueue struct {
	inbox  []int // 新元素都压进这里
	outbox []int // 出队都从这里弹
}

func Constructor() MyQueue {
	return MyQueue{} //@init
}

func (q *MyQueue) Push(x int) {
	q.inbox = append(q.inbox, x) //@push
}

func (q *MyQueue) Pop() int {
	x := q.Peek()                       // 先保证 outbox 里有元素 //@pop
	q.outbox = q.outbox[:len(q.outbox)-1] //@pop
	return x                            //@pop
}

func (q *MyQueue) Peek() int {
	if len(q.outbox) == 0 { // outbox 空了才倒 //@move
		for len(q.inbox) > 0 { // 把 inbox 整个倒过来 //@move
			q.outbox = append(q.outbox, q.inbox[len(q.inbox)-1]) //@move
			q.inbox = q.inbox[:len(q.inbox)-1]                   //@move
		}
	}
	return q.outbox[len(q.outbox)-1] //@peek
}

func (q *MyQueue) Empty() bool {
	return len(q.inbox) == 0 && len(q.outbox) == 0 //@empty
}
