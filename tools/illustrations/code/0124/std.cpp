class Solution {
public:
    int maxPathSum(TreeNode* root) {
        best = INT_MIN;                                 //@init
        gain(root);                                     //@init
        return best;                                    //@done
    }

private:
    int best;

    // 从 node 往下一条链的最大和
    int gain(TreeNode* node) {
        if (!node) return 0;
        int l = max(gain(node->left), 0);               // 负的就不要了 //@node
        int r = max(gain(node->right), 0);              //@node
        best = max(best, node->val + l + r);            // 以 node 为最高点的路径 //@node
        return node->val + max(l, r);                   // 往上只能带一条链 //@node
    }
};
