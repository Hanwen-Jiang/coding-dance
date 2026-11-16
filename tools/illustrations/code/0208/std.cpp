struct TrieNode {
    TrieNode* children[26] = {};
    bool isEnd = false;
};

class Trie {
public:
    Trie() {
        root = new TrieNode();                          //@init
    }

    void insert(string word) {
        TrieNode* node = root;                          //@insert
        for (char c : word) {                           //@insert
            int i = c - 'a';                            //@insert
            if (!node->children[i]) {                   //@insert
                node->children[i] = new TrieNode();     // 没有路就新建 //@insert
            }
            node = node->children[i];                   //@insert
        }
        node->isEnd = true;                             // 标记单词结尾 //@insert
    }

    bool search(string word) {
        TrieNode* node = find(word);                    //@search
        return node && node->isEnd;                     //@search
    }

    bool startsWith(string prefix) {
        return find(prefix) != nullptr;                 //@starts
    }

private:
    TrieNode* root;

    TrieNode* find(const string& s) {
        TrieNode* node = root;                          //@find
        for (char c : s) {                              //@find
            node = node->children[c - 'a'];             //@find
            if (!node) {                                //@find
                return nullptr;                         //@find
            }
        }
        return node;                                    //@find
    }
};
