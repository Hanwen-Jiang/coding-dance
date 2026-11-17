class Solution {
public:
    int jump(vector<int>& nums) {
        int jumps = 0, end = 0, far = 0;            // end：当前这一跳能到的右端 //@init
        for (int i = 0; i + 1 < nums.size(); i++) { // 最后一个位置不用再跳
            far = max(far, i + nums[i]);            //@far,edge
            if (i == end) {                         // 这一层走完了，必须再跳一次 //@far,edge
                jumps++;                            //@jump
                end = far;                          //@jump
            }
        }
        return jumps;                               //@done
    }
};
