class Solution {
public:
    bool isValidBST(TreeNode* root) {
        return check(root, LLONG_MIN, LLONG_MAX);   // 用 long long，节点值能取到 int 的边界 //@start
    }

private:
    // node 的值必须在开区间 (lo, hi) 里
    bool check(TreeNode* node, long long lo, long long hi) {
        if (!node) {
            return true;
        }
        if (node->val <= lo || node->val >= hi) {   //@range
            return false;                           //@bad
        }
        return check(node->left, lo, node->val) && check(node->right, node->val, hi);  //@down
    }
};
