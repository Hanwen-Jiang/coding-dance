class TrieNode {
    constructor() {
        this.children = new Map();              // 字符 -> 子节点
        this.pass = 0;                          // 经过这个节点的单词数
        this.end = false;                       // 有没有单词在这里结束
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();             //@init
    }

    insert(word) {
        let node = this.root;                   //@ins
        for (const ch of word) {                //@ins
            if (!node.children.has(ch)) {       // 没有这条路就新建 //@new
                node.children.set(ch, new TrieNode());  //@new
            }
            node = node.children.get(ch);       //@walk
            node.pass++;                        //@walk
        }
        node.end = true;                        // 标记单词在这里结束 //@mark
    }

    find(s) {
        let node = this.root;
        for (const ch of s) {                   //@find
            node = node.children.get(ch);       //@find
            if (!node) {                        // 走不下去了 //@miss
                return null;                    //@miss
            }
        }
        return node;
    }

    search(word) {
        const node = this.find(word);           //@search
        return !!node && node.end;              // 还要看结束标记 //@search
    }

    countPrefix(prefix) {
        const node = this.find(prefix);         //@count
        return node ? node.pass : 0;            //@count
    }
}
