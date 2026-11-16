class Solution {
public:
    void flatten(TreeNode* root) {
        prev = nullptr;                             //@init
        dfs(root);                                  //@init
    }

private:
    TreeNode* prev = nullptr;

    // 按 右 → 左 → 根 的顺序访问，从链表的尾巴往头接
    void dfs(TreeNode* node) {
        if (!node) {
            return;
        }
        dfs(node->right);
        dfs(node->left);
        node->right = prev;                         //@link
        node->left = nullptr;                       //@link
        prev = node;                                //@link
    }
};
