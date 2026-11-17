class Solution {
public:
    TreeNode* sortedArrayToBST(vector<int>& nums) {
        return build(nums, 0, (int)nums.size() - 1);   //@init,done
    }

private:
    TreeNode* build(vector<int>& nums, int lo, int hi) {
        if (lo > hi) {
            return nullptr;
        }
        int mid = (lo + hi) / 2;                        //@node
        TreeNode* node = new TreeNode(nums[mid]);       //@node
        node->left = build(nums, lo, mid - 1);          //@sub
        node->right = build(nums, mid + 1, hi);         //@sub
        return node;
    }
};
