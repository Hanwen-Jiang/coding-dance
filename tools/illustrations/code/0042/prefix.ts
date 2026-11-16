function trap(height: number[]): number {
    const n = height.length, left = new Array<number>(n), right = new Array<number>(n);
    for (let i = 0; i < n; i++) {               // 从左往右：到这里为止最高的柱子 //@left
        left[i] = Math.max(i > 0 ? left[i - 1] : 0, height[i]);     //@left
    }
    for (let i = n - 1; i >= 0; i--) {          // 从右往左：它右边（含自己）最高的柱子 //@right
        right[i] = Math.max(i < n - 1 ? right[i + 1] : 0, height[i]);   //@right
    }
    let water = 0;
    for (let i = 0; i < n; i++) {               //@each
        water += Math.min(left[i], right[i]) - height[i];   // 水位是两边最高里较矮的那个 //@each
    }
    return water;                               //@done
}
