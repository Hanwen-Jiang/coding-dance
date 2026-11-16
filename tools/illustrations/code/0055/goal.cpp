class Solution {
public:
    bool canJump(vector<int>& nums) {
        int goal = nums.size() - 1;                 //@init
        for (int i = (int)nums.size() - 2; i >= 0; i--) {
            if (i + nums[i] >= goal) {              //@move,stay
                goal = i;                           //@move
            }
        }
        return goal == 0;                           //@done
    }
};
