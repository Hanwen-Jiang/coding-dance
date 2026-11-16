class TrieNode {
    children: (TrieNode | null)[] = new Array(26).fill(null);
    isEnd = false;
}

class Trie {
    private root: TrieNode;

    constructor() {
        this.root = new TrieNode();                 //@init
    }

    insert(word: string): void {
        let node = this.root;                       //@insert
        for (const c of word) {                     //@insert
            const i = c.charCodeAt(0) - 97;         //@insert
            if (!node.children[i]) {                //@insert
                node.children[i] = new TrieNode();  // 没有路就新建 //@insert
            }
            node = node.children[i]!;               //@insert
        }
        node.isEnd = true;                          // 标记单词结尾 //@insert
    }

    private find(s: string): TrieNode | null {
        let node: TrieNode | null = this.root;      //@find
        for (const c of s) {                        //@find
            node = node.children[c.charCodeAt(0) - 97];     //@find
            if (!node) {                            //@find
                return null;                        //@find
            }
        }
        return node;                                //@find
    }

    search(word: string): boolean {
        const node = this.find(word);               //@search
        return node !== null && node.isEnd;         //@search
    }

    startsWith(prefix: string): boolean {
        return this.find(prefix) !== null;          //@starts
    }
}
