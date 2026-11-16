class Solution {
    public int trap(int[] height) {
        Deque<Integer> stack = new ArrayDeque<>();      // 栈里存下标，高度从底到顶递减 //@init
        int water = 0;                                  //@init
        for (int i = 0; i < height.length; i++) {
            while (!stack.isEmpty() && height[stack.peek()] < height[i]) {  //@nowall,fill
                int bottom = stack.pop();               // 坑底 //@nowall,fill
                if (stack.isEmpty()) {                  //@nowall
                    break;                              // 左边没有墙，接不住 //@nowall
                }
                int left = stack.peek();                //@fill
                int width = i - left - 1;               //@fill
                water += (Math.min(height[left], height[i]) - height[bottom]) * width;  //@fill
            }
            stack.push(i);                              //@push
        }
        return water;                                   //@done
    }
}
