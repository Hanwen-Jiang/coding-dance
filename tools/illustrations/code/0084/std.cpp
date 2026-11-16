class Solution {
public:
    int largestRectangleArea(vector<int>& heights) {
        vector<int> h(heights.size() + 2, 0);           // 两头加哨兵 //@init
        copy(heights.begin(), heights.end(), h.begin() + 1);    //@init
        vector<int> stack;                              // 栈里下标对应的高度递增 //@init
        int best = 0;                                   //@init
        for (int i = 0; i < (int)h.size(); i++) {
            while (!stack.empty() && h[stack.back()] > h[i]) {  //@pop
                int top = stack.back();                 // 以它为高的矩形，右边界是 i //@pop
                stack.pop_back();                       //@pop
                int left = stack.back();                // 左边界是新的栈顶 //@pop
                best = max(best, h[top] * (i - left - 1));      //@pop
            }
            stack.push_back(i);                         //@push
        }
        return best;                                    //@done
    }
};
