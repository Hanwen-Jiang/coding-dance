class Solution {
public:
    bool canJump(vector<int>& nums) {
        int far = 0;                                // 目前能到的最远下标 //@init
        for (int i = 0; i < (int)nums.size(); i++) {
            if (i > far) {                          // 连 i 都到不了 //@bad
                return false;                       //@bad
            }
            far = max(far, i + nums[i]);            //@grow
            if (far >= (int)nums.size() - 1) {      //@grow,reach
                return true;                        //@reach
            }
        }
        return true;
    }
};
