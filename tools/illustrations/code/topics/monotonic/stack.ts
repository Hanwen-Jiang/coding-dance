function finalPrices(prices: number[]): number[] {
    const ans = prices.slice();
    const stack: number[] = [];                     // 还没找到折扣的下标，价格从栈底到栈顶递增 //@init
    prices.forEach((p, i) => {                      //@loop
        while (stack.length && prices[stack[stack.length - 1]] >= p) {  // p 是它右边第一个不超过它的价格 //@pop
            ans[stack.pop()!] -= p;                 //@pop
        }
        stack.push(i);                              //@push
    });
    return ans;                                     //@done
}
