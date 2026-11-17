class Solution {
    vector<int> pre, ino, post;

    void dfs(TreeNode* node) {
        if (!node) {                            //@base
            return;                             //@base
        }
        pre.push_back(node->val);               // 前序：刚进入这个节点 //@pre
        dfs(node->left);                        //@left
        ino.push_back(node->val);               // 中序：左子树走完了 //@in
        dfs(node->right);                       //@right
        post.push_back(node->val);              // 后序：两棵子树都走完了 //@post
    }

public:
    vector<vector<int>> traversals(TreeNode* root) {
        dfs(root);                              //@start
        return {pre, ino, post};                //@done
    }
};
