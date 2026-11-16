function trap(height: number[]): number {
    const stack: number[] = [];                     // 栈里存下标，高度从底到顶递减 //@init
    let water = 0;                                  //@init
    for (let i = 0; i < height.length; i++) {
        while (stack.length && height[stack[stack.length - 1]] < height[i]) {   //@nowall,fill
            const bottom = stack.pop()!;            // 坑底 //@nowall,fill
            if (!stack.length) {                    //@nowall
                break;                              // 左边没有墙，接不住 //@nowall
            }
            const left = stack[stack.length - 1];   //@fill
            const width = i - left - 1;             //@fill
            water += (Math.min(height[left], height[i]) - height[bottom]) * width;  //@fill
        }
        stack.push(i);                              //@push
    }
    return water;                                   //@done
}
