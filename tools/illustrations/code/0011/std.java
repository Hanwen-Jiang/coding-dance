class Solution {
    public int maxArea(int[] height) {
        int l = 0, r = height.length - 1;          //@init
        int best = 0;                               //@init
        while (l < r) {
            best = Math.max(best, Math.min(height[l], height[r]) * (r - l));   //@area
            if (height[l] < height[r]) {            // 移动短板 //@move
                l++;                                //@move
            } else {                                //@move
                r--;                                //@move
            }
        }
        return best;                                //@done
    }
}
