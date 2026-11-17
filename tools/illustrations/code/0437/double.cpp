class Solution {
public:
    int pathSum(TreeNode* root, int targetSum) {
        if (!root) {                                    //@empty
            return 0;                                   //@empty
        }
        return down(root, targetSum) + pathSum(root->left, targetSum) + pathSum(root->right, targetSum);  //@start,done
    }

private:
    // 从 node 开始往下、和为 t 的路径数（t 会越减越小，用 long long 防溢出）
    int down(TreeNode* node, long long t) {
        if (!node) {
            return 0;
        }
        return (node->val == t) + down(node->left, t - node->val) + down(node->right, t - node->val);    //@down
    }
};
