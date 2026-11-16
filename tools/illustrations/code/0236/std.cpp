class Solution {
public:
    TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
        if (!root || root == p || root == q) {          //@base
            return root;                                // 空，或者就是要找的节点 //@base
        }
        TreeNode* left = lowestCommonAncestor(root->left, p, q);    //@rec
        TreeNode* right = lowestCommonAncestor(root->right, p, q);  //@rec
        if (left && right) {                            //@both,one
            return root;                                // p、q 分在两边 //@both
        }
        return left ? left : right;                     // 哪边有就交哪边 //@one
    }
};
