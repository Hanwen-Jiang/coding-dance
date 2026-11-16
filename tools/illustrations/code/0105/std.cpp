class Solution {
public:
    TreeNode* buildTree(vector<int>& preorder, vector<int>& inorder) {
        unordered_map<int, int> idx;
        for (int i = 0; i < (int)inorder.size(); i++) {
            idx[inorder[i]] = i;                        // 值 -> 中序下标 //@init
        }
        // 前序 [pl, pr)，中序 [il, ir)
        function<TreeNode*(int, int, int, int)> build = [&](int pl, int pr, int il, int ir) -> TreeNode* {
            if (pl == pr) {
                return nullptr;
            }
            TreeNode* root = new TreeNode(preorder[pl]);    // 前序第一个是根 //@root
            int k = idx[root->val];                     //@root
            int leftSize = k - il;                      // 中序里根左边的都是左子树 //@root
            root->left = build(pl + 1, pl + 1 + leftSize, il, k);      //@sub
            root->right = build(pl + 1 + leftSize, pr, k + 1, ir);     //@sub
            return root;
        };
        return build(0, preorder.size(), 0, inorder.size());   //@init,done
    }
};
