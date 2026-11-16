class Solution {
public:
    int maxProfit(vector<int>& prices) {
        int minPrice = INT_MAX, best = 0;               //@init
        for (int p : prices) {
            minPrice = min(minPrice, p);                // 到今天为止的最低价 //@low
            best = max(best, p - minPrice);             // 今天卖出能赚多少 //@sell
        }
        return best;                                    //@done
    }
};
