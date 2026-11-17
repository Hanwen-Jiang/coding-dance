class Solution {
public:
    vector<int> inorderTraversal(TreeNode* root) {
        vector<int> res;                                //@init
        stack<TreeNode*> st;                            //@init
        TreeNode* cur = root;                           //@init
        while (cur || !st.empty()) {                    //@loop
            while (cur) {                               // 一路往左走，沿途的节点压栈 //@push
                st.push(cur);                           //@push
                cur = cur->left;                        //@push
            }
            cur = st.top();                             // 左边到头了，弹出来访问 //@pop
            st.pop();                                   //@pop
            res.push_back(cur->val);                    //@pop
            cur = cur->right;                           // 再去它的右子树 //@right
        }
        return res;                                     //@done
    }
};
