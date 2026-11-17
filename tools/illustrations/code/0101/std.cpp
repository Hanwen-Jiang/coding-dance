class Solution {
public:
    bool isSymmetric(TreeNode* root) {
        return check(root->left, root->right);      //@start
    }

private:
    // a 和 b 两棵子树是否互为镜像
    bool check(TreeNode* a, TreeNode* b) {
        if (!a && !b) {                             //@both
            return true;                            //@both
        }
        if (!a || !b || a->val != b->val) {         //@diff
            return false;                           //@diff
        }
        return check(a->left, b->right) && check(a->right, b->left);   //@same
    }
};
