class TrieNode {
    TrieNode[] children = new TrieNode[26];     // 只有小写字母：下标是 ch - 'a'
    int pass;                                   // 经过这个节点的单词数
    boolean end;                                // 有没有单词在这里结束
}

class Trie {
    private final TrieNode root = new TrieNode();   //@init

    public void insert(String word) {
        TrieNode node = root;                       //@ins
        for (char ch : word.toCharArray()) {        //@ins
            int c = ch - 'a';                       //@ins
            if (node.children[c] == null) {         // 没有这条路就新建 //@new
                node.children[c] = new TrieNode();  //@new
            }
            node = node.children[c];                //@walk
            node.pass++;                            //@walk
        }
        node.end = true;                            // 标记单词在这里结束 //@mark
    }

    private TrieNode find(String s) {
        TrieNode node = root;
        for (char ch : s.toCharArray()) {           //@find
            node = node.children[ch - 'a'];         //@find
            if (node == null) {                     // 走不下去了 //@miss
                return null;                        //@miss
            }
        }
        return node;
    }

    public boolean search(String word) {
        TrieNode node = find(word);                 //@search
        return node != null && node.end;            // 还要看结束标记 //@search
    }

    public int countPrefix(String prefix) {
        TrieNode node = find(prefix);               //@count
        return node == null ? 0 : node.pass;        //@count
    }
}
