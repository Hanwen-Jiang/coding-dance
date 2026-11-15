class Solution {
public:
    vector<vector<int>> levelOrder(TreeNode* root) {
        vector<vector<int>> res;
        if (!root) {
            return res;
        }
        queue<TreeNode*> q;                     //@init
        q.push(root);                           //@init
        while (!q.empty()) {
            vector<int> level;                  //@level
            int n = q.size();                   // 这一层有 n 个节点 //@level
            for (int i = 0; i < n; i++) {       //@level
                TreeNode* node = q.front();     //@pop
                q.pop();                        //@pop
                level.push_back(node->val);     //@pop
                if (node->left) {               //@push
                    q.push(node->left);         //@push
                }
                if (node->right) {              //@push
                    q.push(node->right);        //@push
                }
            }
            res.push_back(level);               //@end
        }
        return res;                             //@done
    }
};
