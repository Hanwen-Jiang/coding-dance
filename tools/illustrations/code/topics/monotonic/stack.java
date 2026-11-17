class Solution {
    public int[] finalPrices(int[] prices) {
        int[] ans = prices.clone();
        Deque<Integer> stack = new ArrayDeque<>();      // 还没找到折扣的下标，价格从栈底到栈顶递增 //@init
        for (int i = 0; i < prices.length; i++) {       //@loop
            while (!stack.isEmpty() && prices[stack.peek()] >= prices[i]) { // prices[i] 是它右边第一个不超过它的价格 //@pop
                ans[stack.pop()] -= prices[i];          //@pop
            }
            stack.push(i);                              //@push
        }
        return ans;                                     //@done
    }
}
