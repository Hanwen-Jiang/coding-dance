type rootNode struct {
	children [26]*rootNode
	end      bool // 有词根在这里结束
}

func replaceWords(dictionary []string, sentence string) string {
	root := &rootNode{} //@build
	for _, w := range dictionary { //@build
		node := root //@build
		for _, ch := range w { //@build
			if node.children[ch-'a'] == nil { //@build
				node.children[ch-'a'] = &rootNode{} //@build
			}
			node = node.children[ch-'a'] //@build
		}
		node.end = true //@build
	}
	res := []string{}
	for _, word := range strings.Fields(sentence) { //@word
		node, cut := root, word //@word
		for i := 0; i < len(word); i++ { //@walk
			node = node.children[word[i]-'a'] // 路断了就是没有词根是它的前缀 //@walk
			if node == nil { //@walk
				break //@walk
			}
			if node.end { // 第一次碰到结束标记：最短的词根 //@hit
				cut = word[:i+1] //@hit
				break            //@hit
			}
		}
		res = append(res, cut) //@add
	}
	return strings.Join(res, " ") //@done
}
