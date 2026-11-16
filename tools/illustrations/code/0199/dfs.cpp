class Solution {
public:
    vector<int> rightSideView(TreeNode* root) {
        vector<int> res;                                //@init
        dfs(root, 0, res);                              //@init
        return res;                                     //@done
    }

private:
    void dfs(TreeNode* node, int depth, vector<int>& res) {
        if (!node) return;
        if (depth == (int)res.size()) {                 // 这一层第一次到 //@first,pass
            res.push_back(node->val);                   //@first
        }
        dfs(node->right, depth + 1, res);               // 先右
        dfs(node->left, depth + 1, res);                // 后左
    }
};
