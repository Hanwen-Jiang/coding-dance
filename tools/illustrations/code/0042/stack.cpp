class Solution {
public:
    int trap(vector<int>& height) {
        vector<int> stack;                              // 栈里存下标，高度从底到顶递减 //@init
        int water = 0;                                  //@init
        for (int i = 0; i < (int)height.size(); i++) {
            while (!stack.empty() && height[stack.back()] < height[i]) {    //@nowall,fill
                int bottom = stack.back();              // 坑底 //@nowall,fill
                stack.pop_back();                       //@nowall,fill
                if (stack.empty()) {                    //@nowall
                    break;                              // 左边没有墙，接不住 //@nowall
                }
                int left = stack.back();                //@fill
                int width = i - left - 1;               //@fill
                water += (min(height[left], height[i]) - height[bottom]) * width;   //@fill
            }
            stack.push_back(i);                         //@push
        }
        return water;                                   //@done
    }
};
