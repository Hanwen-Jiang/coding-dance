class Solution {
public:
    vector<int> inorderTraversal(TreeNode* root) {
        vector<int> res;                            //@init
        dfs(root, res);                             //@init
        return res;                                 //@done
    }

private:
    void dfs(TreeNode* node, vector<int>& res) {
        if (!node) {                                //@enter
            return;
        }
        dfs(node->left, res);                       // 左 //@enter
        res.push_back(node->val);                   // 自己 //@visit
        dfs(node->right, res);                      // 右 //@visit
    }
};
