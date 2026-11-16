class TrieNode {
    constructor() {
        this.children = new Array(26).fill(null);
        this.isEnd = false;
    }
}

var Trie = function() {
    this.root = new TrieNode();                     //@init
};

Trie.prototype.insert = function(word) {
    let node = this.root;                           //@insert
    for (const c of word) {                         //@insert
        const i = c.charCodeAt(0) - 97;             //@insert
        if (!node.children[i]) {                    //@insert
            node.children[i] = new TrieNode();      // 没有路就新建 //@insert
        }
        node = node.children[i];                    //@insert
    }
    node.isEnd = true;                              // 标记单词结尾 //@insert
};

Trie.prototype.find = function(s) {
    let node = this.root;                           //@find
    for (const c of s) {                            //@find
        node = node.children[c.charCodeAt(0) - 97]; //@find
        if (!node) {                                //@find
            return null;                            //@find
        }
    }
    return node;                                    //@find
};

Trie.prototype.search = function(word) {
    const node = this.find(word);                   //@search
    return node !== null && node.isEnd;             //@search
};

Trie.prototype.startsWith = function(prefix) {
    return this.find(prefix) !== null;              //@starts
};
