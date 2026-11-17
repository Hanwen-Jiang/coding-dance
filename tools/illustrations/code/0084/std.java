class Solution {
    public int largestRectangleArea(int[] heights) {
        int n = heights.length;
        int[] h = new int[n + 2];                       // 两头加哨兵 //@init
        System.arraycopy(heights, 0, h, 1, n);          //@init
        Deque<Integer> stack = new ArrayDeque<>();      // 栈里下标对应的高度递增 //@init
        int best = 0;                                   //@init
        for (int i = 0; i < h.length; i++) {
            while (!stack.isEmpty() && h[stack.peek()] > h[i]) {    //@pop
                int top = stack.pop();                  // 以它为高的矩形，右边界是 i //@pop
                int left = stack.peek();                // 左边界是新的栈顶 //@pop
                best = Math.max(best, h[top] * (i - left - 1));     //@pop
            }
            stack.push(i);                              //@push
        }
        return best;                                    //@done
    }
}
