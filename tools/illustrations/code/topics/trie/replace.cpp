class Solution {
    struct Node {
        Node* children[26] = {};
        bool end = false;                           // 有词根在这里结束
    };

public:
    string replaceWords(vector<string>& dictionary, string sentence) {
        Node* root = new Node();                    //@build
        for (auto& w : dictionary) {                //@build
            Node* node = root;                      //@build
            for (char ch : w) {                     //@build
                if (!node->children[ch - 'a']) {    //@build
                    node->children[ch - 'a'] = new Node();  //@build
                }
                node = node->children[ch - 'a'];    //@build
            }
            node->end = true;                       //@build
        }
        string res;
        stringstream ss(sentence);
        for (string word; ss >> word;) {            //@word
            Node* node = root;                      //@word
            string cut = word;                      //@word
            for (int i = 0; i < (int)word.size(); i++) {    //@walk
                node = node->children[word[i] - 'a'];   // 路断了就是没有词根是它的前缀 //@walk
                if (!node) {                        //@walk
                    break;                          //@walk
                }
                if (node->end) {                    // 第一次碰到结束标记：最短的词根 //@hit
                    cut = word.substr(0, i + 1);    //@hit
                    break;                          //@hit
                }
            }
            res += (res.empty() ? "" : " ") + cut;  //@add
        }
        return res;                                 //@done
    }
};
