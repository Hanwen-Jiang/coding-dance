class TrieNode {
    children = new Map<string, TrieNode>();     // 字符 -> 子节点
    pass = 0;                                   // 经过这个节点的单词数
    end = false;                                // 有没有单词在这里结束
}

class Trie {
    private root = new TrieNode();              //@init

    insert(word: string): void {
        let node = this.root;                   //@ins
        for (const ch of word) {                //@ins
            if (!node.children.has(ch)) {       // 没有这条路就新建 //@new
                node.children.set(ch, new TrieNode());  //@new
            }
            node = node.children.get(ch)!;      //@walk
            node.pass++;                        //@walk
        }
        node.end = true;                        // 标记单词在这里结束 //@mark
    }

    private find(s: string): TrieNode | null {
        let node: TrieNode | undefined = this.root;
        for (const ch of s) {                   //@find
            node = node.children.get(ch);       //@find
            if (!node) {                        // 走不下去了 //@miss
                return null;                    //@miss
            }
        }
        return node;
    }

    search(word: string): boolean {
        const node = this.find(word);           //@search
        return node !== null && node.end;       // 还要看结束标记 //@search
    }

    countPrefix(prefix: string): number {
        const node = this.find(prefix);         //@count
        return node ? node.pass : 0;            //@count
    }
}
