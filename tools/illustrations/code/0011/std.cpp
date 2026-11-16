class Solution {
public:
    int maxArea(vector<int>& height) {
        int l = 0, r = height.size() - 1;          //@init
        int best = 0;                               //@init
        while (l < r) {
            best = max(best, min(height[l], height[r]) * (r - l));     //@area
            if (height[l] < height[r]) {            // 移动短板 //@move
                l++;                                //@move
            } else {                                //@move
                r--;                                //@move
            }
        }
        return best;                                //@done
    }
};
