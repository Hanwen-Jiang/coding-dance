class Solution {
public:
    TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
        unordered_map<TreeNode*, TreeNode*> parent{{root, nullptr}};  //@init
        vector<TreeNode*> stack{root};                  //@init
        while (!parent.count(p) || !parent.count(q)) {  //@parent
            TreeNode* node = stack.back();              //@parent
            stack.pop_back();                           //@parent
            for (TreeNode* child : {node->left, node->right}) {     //@parent
                if (child) {                            //@parent
                    parent[child] = node;               //@parent
                    stack.push_back(child);             //@parent
                }
            }
        }
        unordered_set<TreeNode*> ancestors;             //@up
        while (p) {                                     // p 和它所有的祖先 //@up
            ancestors.insert(p);                        //@up
            p = parent[p];                              //@up
        }
        while (!ancestors.count(q)) {                   // q 往上走，第一个碰到的就是答案 //@climb
            q = parent[q];                              //@climb
        }
        return q;                                       //@done
    }
};
