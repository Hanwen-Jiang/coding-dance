class Solution {
public:
    vector<int> largestValues(TreeNode* root) {
        vector<int> res;
        queue<TreeNode*> q;                         //@init
        if (root) {                                 //@init
            q.push(root);                           //@init
        }
        while (!q.empty()) {
            int best = q.front()->val;              //@level
            for (int n = q.size(); n > 0; n--) {    // 这一层有 q.size() 个节点 //@level
                TreeNode* node = q.front();         //@pop
                q.pop();                            //@pop
                best = max(best, node->val);        //@pop
                if (node->left) {                   //@push
                    q.push(node->left);             //@push
                }
                if (node->right) {                  //@push
                    q.push(node->right);            //@push
                }
            }
            res.push_back(best);                    //@end
        }
        return res;                                 //@done
    }
};
