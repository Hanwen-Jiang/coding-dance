class Solution {
public:
    bool isValidBST(TreeNode* root) {
        long long prev = LLONG_MIN;             // 比任何 int 都小 //@init
        function<bool(TreeNode*)> inorder = [&](TreeNode* node) {
            if (!node) {
                return true;
            }
            if (!inorder(node->left)) {
                return false;
            }
            if (node->val <= prev) {            // 必须比前一个大 //@bad
                return false;                   //@bad
            }
            prev = node->val;                   //@ok
            return inorder(node->right);
        };
        return inorder(root);                   //@done
    }
};
