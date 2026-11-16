function dailyTemperatures(temperatures: number[]): number[] {
    const ans: number[] = new Array(temperatures.length).fill(0);  //@init
    const stack: number[] = [];                 // 还在等待的日子（下标），温度从底到顶递减 //@init
    temperatures.forEach((t, i) => {
        while (stack.length && temperatures[stack[stack.length - 1]] < t) {    //@pop
            const j = stack.pop()!;             //@pop
            ans[j] = i - j;                     // 第 j 天等到了第 i 天 //@pop
        }
        stack.push(i);                          //@push
    });
    return ans;                                 //@done
}
