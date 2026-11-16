class Solution {
public:
    int maxDepth(TreeNode* root) {
        if (!root) {                        //@base
            return 0;                       //@base
        }
        return max(maxDepth(root->left), maxDepth(root->right)) + 1;   //@down,depth
    }
};
