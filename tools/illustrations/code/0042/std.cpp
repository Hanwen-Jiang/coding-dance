class Solution {
public:
    int trap(vector<int>& height) {
        int l = 0, r = height.size() - 1;           //@init
        int leftMax = 0, rightMax = 0;              //@init
        int water = 0;                              //@init
        while (l < r) {
            leftMax = max(leftMax, height[l]);      //@left,right
            rightMax = max(rightMax, height[r]);    //@left,right
            if (leftMax < rightMax) {               // 左边矮，l 这一格水位就是 leftMax //@left
                water += leftMax - height[l];       //@left
                l++;                                //@left
            } else {                                //@right
                water += rightMax - height[r];      //@right
                r--;                                //@right
            }
        }
        return water;                               //@done
    }
};
