var largestRectangleArea = function(heights) {
    const h = [0, ...heights, 0];                   // 两头加哨兵 //@init
    const stack = [];                               // 栈里下标对应的高度递增 //@init
    let best = 0;                                   //@init
    for (let i = 0; i < h.length; i++) {
        while (stack.length && h[stack[stack.length - 1]] > h[i]) {     //@pop
            const top = stack.pop();                // 以它为高的矩形，右边界是 i //@pop
            const left = stack[stack.length - 1];   // 左边界是新的栈顶 //@pop
            best = Math.max(best, h[top] * (i - left - 1));     //@pop
        }
        stack.push(i);                              //@push
    }
    return best;                                    //@done
};
