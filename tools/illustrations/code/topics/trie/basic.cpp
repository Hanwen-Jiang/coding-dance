struct TrieNode {
    TrieNode* children[26] = {};                // 只有小写字母：下标是 ch - 'a'
    int pass = 0;                               // 经过这个节点的单词数
    bool end = false;                           // 有没有单词在这里结束
};

class Trie {
    TrieNode* root = new TrieNode();            //@init

    TrieNode* find(const string& s) {
        TrieNode* node = root;
        for (char ch : s) {                     //@find
            node = node->children[ch - 'a'];    //@find
            if (!node) {                        // 走不下去了 //@miss
                return nullptr;                 //@miss
            }
        }
        return node;
    }

public:
    void insert(string word) {
        TrieNode* node = root;                  //@ins
        for (char ch : word) {                  //@ins
            int c = ch - 'a';                   //@ins
            if (!node->children[c]) {           // 没有这条路就新建 //@new
                node->children[c] = new TrieNode();     //@new
            }
            node = node->children[c];           //@walk
            node->pass++;                       //@walk
        }
        node->end = true;                       // 标记单词在这里结束 //@mark
    }

    bool search(string word) {
        TrieNode* node = find(word);            //@search
        return node && node->end;               // 还要看结束标记 //@search
    }

    int countPrefix(string prefix) {
        TrieNode* node = find(prefix);          //@count
        return node ? node->pass : 0;           //@count
    }
};
