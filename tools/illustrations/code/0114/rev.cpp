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
        dfs(node->right);                           //@goR
        dfs(node->left);                            //@goL
        node->right = prev;                         //@linkR
        node->left = nullptr;                       //@clearL
        prev = node;                                //@setP
    }
};
