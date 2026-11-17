class Solution {
public:
    int kthSmallest(TreeNode* root, int k) {
        vector<TreeNode*> stack;                        //@init
        TreeNode* cur = root;                           //@init
        while (true) {
            while (cur) {                               // 一路向左 //@left
                stack.push_back(cur);                   //@left
                cur = cur->left;                        //@left
            }
            cur = stack.back();                         //@pop
            stack.pop_back();                           //@pop
            k--;                                        //@pop
            if (k == 0) {                               // 中序遍历的第 k 个 //@found
                return cur->val;                        //@found
            }
            cur = cur->right;                           //@right
        }
    }
};
