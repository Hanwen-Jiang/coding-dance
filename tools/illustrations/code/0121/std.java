class Solution {
    public int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE, best = 0;     //@init
        for (int p : prices) {
            minPrice = Math.min(minPrice, p);           // 到今天为止的最低价 //@low
            best = Math.max(best, p - minPrice);        // 今天卖出能赚多少 //@sell
        }
        return best;                                    //@done
    }
}
