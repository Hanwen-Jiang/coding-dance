class Solution {
public:
    vector<int> rightSideView(TreeNode* root) {
        vector<int> res;                                //@init
        queue<TreeNode*> q;                             //@init
        if (root) q.push(root);                         //@init
        while (!q.empty()) {                            //@level
            res.push_back(q.back()->val);               // 这一层最右边的节点 //@level
            for (int i = q.size(); i > 0; i--) {        //@level
                TreeNode* node = q.front(); q.pop();    //@level
                if (node->left) q.push(node->left);     //@level
                if (node->right) q.push(node->right);   //@level
            }
        }
        return res;                                     //@done
    }
};
