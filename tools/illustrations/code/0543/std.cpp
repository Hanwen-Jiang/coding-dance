class Solution {
public:
    int diameterOfBinaryTree(TreeNode* root) {
        int best = 0;                           //@init
        function<int(TreeNode*)> depth = [&](TreeNode* node) {
            if (!node) {
                return 0;
            }
            int l = depth(node->left), r = depth(node->right);  //@calc
            best = max(best, l + r);            // 在这个节点拐弯的最长路径 //@calc
            return max(l, r) + 1;               // 返回给上一层的是深度 //@calc
        };
        depth(root);                            //@init
        return best;                            //@done
    }
};
