class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        int[] ans = new int[temperatures.length];   //@init
        Deque<Integer> stack = new ArrayDeque<>();  // 还在等待的日子（下标），温度从底到顶递减 //@init
        for (int i = 0; i < temperatures.length; i++) {
            while (!stack.isEmpty() && temperatures[stack.peek()] < temperatures[i]) {  //@pop
                int j = stack.pop();                //@pop
                ans[j] = i - j;                     // 第 j 天等到了第 i 天 //@pop
            }
            stack.push(i);                          //@push
        }
        return ans;                                 //@done
    }
}
