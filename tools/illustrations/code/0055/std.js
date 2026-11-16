var canJump = function(nums) {
    let far = 0;                                    // 目前能到的最远下标 //@init
    for (let i = 0; i < nums.length; i++) {
        if (i > far) {                              // 连 i 都到不了 //@bad
            return false;                           //@bad
        }
        far = Math.max(far, i + nums[i]);           //@grow
        if (far >= nums.length - 1) {               //@grow,reach
            return true;                            //@reach
        }
    }
    return true;
};
