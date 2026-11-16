class Solution {
public:
    TreeNode* invertTree(TreeNode* root) {
        if (!root) {                        //@base
            return nullptr;                 //@base
        }
        swap(root->left, root->right);      // 交换左右孩子 //@swap
        invertTree(root->left);             //@rec
        invertTree(root->right);            //@rec
        return root;                        //@done
    }
};
