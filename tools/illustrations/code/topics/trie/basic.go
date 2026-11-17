type trieNode struct {
	children [26]*trieNode // 只有小写字母：下标是 ch - 'a'
	pass     int           // 经过这个节点的单词数
	end      bool          // 有没有单词在这里结束
}

type Trie struct {
	root *trieNode
}

func Constructor() Trie {
	return Trie{root: &trieNode{}} //@init
}

func (t *Trie) Insert(word string) {
	node := t.root //@ins
	for _, ch := range word { //@ins
		c := ch - 'a' //@ins
		if node.children[c] == nil { // 没有这条路就新建 //@new
			node.children[c] = &trieNode{} //@new
		}
		node = node.children[c] //@walk
		node.pass++             //@walk
	}
	node.end = true // 标记单词在这里结束 //@mark
}

func (t *Trie) find(s string) *trieNode {
	node := t.root
	for _, ch := range s { //@find
		node = node.children[ch-'a'] //@find
		if node == nil { // 走不下去了 //@miss
			return nil //@miss
		}
	}
	return node
}

func (t *Trie) Search(word string) bool {
	node := t.find(word)            //@search
	return node != nil && node.end // 还要看结束标记 //@search
}

func (t *Trie) CountPrefix(prefix string) int {
	node := t.find(prefix) //@count
	if node == nil {       //@count
		return 0 //@count
	}
	return node.pass //@count
}
