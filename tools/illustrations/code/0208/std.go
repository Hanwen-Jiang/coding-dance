type TrieNode struct {
	children [26]*TrieNode
	isEnd    bool
}

type Trie struct {
	root *TrieNode
}

func Constructor() Trie {
	return Trie{root: &TrieNode{}} //@init
}

func (t *Trie) Insert(word string) {
	node := t.root //@insert
	for _, c := range word { //@insert
		i := c - 'a' //@insert
		if node.children[i] == nil { //@insert
			node.children[i] = &TrieNode{} // 没有路就新建 //@insert
		}
		node = node.children[i] //@insert
	}
	node.isEnd = true // 标记单词结尾 //@insert
}

func (t *Trie) find(s string) *TrieNode {
	node := t.root //@find
	for _, c := range s { //@find
		node = node.children[c-'a'] //@find
		if node == nil { //@find
			return nil //@find
		}
	}
	return node //@find
}

func (t *Trie) Search(word string) bool {
	node := t.find(word)               //@search
	return node != nil && node.isEnd //@search
}

func (t *Trie) StartsWith(prefix string) bool {
	return t.find(prefix) != nil //@starts
}
