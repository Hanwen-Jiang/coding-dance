var maxProfit = function(prices) {
    let minPrice = Infinity, best = 0;              //@init
    for (const p of prices) {
        minPrice = Math.min(minPrice, p);           // 到今天为止的最低价 //@low
        best = Math.max(best, p - minPrice);        // 今天卖出能赚多少 //@sell
    }
    return best;                                    //@done
};
