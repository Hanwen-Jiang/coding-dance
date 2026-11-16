/**
 * 力扣已经定义好了 TreeNode：
 * struct TreeNode {
 *     int val;
 *     TreeNode *left;
 *     TreeNode *right;
 *     TreeNode() : val(0), left(nullptr), right(nullptr) {}
 *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
 *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
 * };
 */
class Solution {
public:
    TreeNode* buildTree(string data) {
        vector<string> vals;                                // "1,2,null" -> ["1", "2", "null"] //@init
        stringstream ss(data);                              //@init
        for (string s; getline(ss, s, ',');) {              //@init
            vals.push_back(s);                              //@init
        }
        if (vals.empty() || vals[0] == "null") {            //@init
            return nullptr;                                 //@init
        }
        TreeNode* root = new TreeNode(stoi(vals[0]));       //@root
        queue<TreeNode*> q;                                 // 还没接孩子的节点 //@root
        q.push(root);                                       //@root
        size_t i = 1;
        while (!q.empty() && i < vals.size()) {             //@take
            TreeNode* node = q.front();                     // 给它接左、右孩子 //@take
            q.pop();                                        //@take
            if (vals[i] != "null") {                        //@left
                node->left = new TreeNode(stoi(vals[i]));   //@left
                q.push(node->left);                         //@left
            }
            i++;                                            //@left
            if (i < vals.size() && vals[i] != "null") {     //@right
                node->right = new TreeNode(stoi(vals[i]));  //@right
                q.push(node->right);                        //@right
            }
            i++;                                            //@right
        }
        return root;                                        //@done
    }
};
