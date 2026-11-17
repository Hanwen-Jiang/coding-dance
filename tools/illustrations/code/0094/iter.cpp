class Solution {
public:
    vector<int> inorderTraversal(TreeNode* root) {
        vector<int> res;                            //@init
        stack<TreeNode*> st;                        //@init
        TreeNode* cur = root;                       //@init
        while (cur || !st.empty()) {
            while (cur) {                           // 一路向左，沿途入栈 //@left
                st.push(cur);                       //@left
                cur = cur->left;                    //@left
            }
            cur = st.top();                         //@pop
            st.pop();                               //@pop
            res.push_back(cur->val);                //@pop
            cur = cur->right;                       // 转向右子树 //@pop
        }
        return res;                                 //@done
    }
};
