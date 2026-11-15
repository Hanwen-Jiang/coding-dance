type node struct {
	key, val   int
	prev, next *node
}

type LRUCache struct {
	cap        int
	m          map[int]*node // key -> 节点
	head, tail *node         // 两个哨兵，省掉判空
}

func Constructor(capacity int) LRUCache {
	head, tail := &node{}, &node{} //@init
	head.next, tail.prev = tail, head //@init
	return LRUCache{cap: capacity, m: map[int]*node{}, head: head, tail: tail} //@init
}

func (c *LRUCache) remove(n *node) {
	n.prev.next, n.next.prev = n.next, n.prev
}

func (c *LRUCache) addFront(n *node) {
	n.prev, n.next = c.head, c.head.next
	c.head.next.prev = n
	c.head.next = n
}

func (c *LRUCache) Get(key int) int {
	n, ok := c.m[key]
	if !ok { //@miss
		return -1 //@miss
	}
	c.remove(n)   // 挪到头部，表示刚用过 //@hit
	c.addFront(n) //@hit
	return n.val  //@hit
}

func (c *LRUCache) Put(key int, value int) {
	if old, ok := c.m[key]; ok { //@old
		c.remove(old) //@old
	}
	n := &node{key: key, val: value} //@put
	c.m[key] = n                     //@put
	c.addFront(n)                    //@put
	if len(c.m) > c.cap {            //@evict
		last := c.tail.prev  // 尾部是最久没用的 //@evict
		c.remove(last)       //@evict
		delete(c.m, last.key) //@evict
	}
}
