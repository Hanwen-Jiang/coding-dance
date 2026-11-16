class TrieNode {
    TrieNode[] children = new TrieNode[26];
    boolean isEnd;
}

class Trie {
    private TrieNode root;

    public Trie() {
        root = new TrieNode();                          //@init
    }

    public void insert(String word) {
        TrieNode node = root;                           //@insert
        for (char c : word.toCharArray()) {             //@insert
            int i = c - 'a';                            //@insert
            if (node.children[i] == null) {             //@insert
                node.children[i] = new TrieNode();      // 没有路就新建 //@insert
            }
            node = node.children[i];                    //@insert
        }
        node.isEnd = true;                              // 标记单词结尾 //@insert
    }

    private TrieNode find(String s) {
        TrieNode node = root;                           //@find
        for (char c : s.toCharArray()) {                //@find
            node = node.children[c - 'a'];              //@find
            if (node == null) {                         //@find
                return null;                            //@find
            }
        }
        return node;                                    //@find
    }

    public boolean search(String word) {
        TrieNode node = find(word);                     //@search
        return node != null && node.isEnd;              //@search
    }

    public boolean startsWith(String prefix) {
        return find(prefix) != null;                    //@starts
    }
}
