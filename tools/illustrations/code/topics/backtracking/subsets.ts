function subsets(nums: number[]): number[][] {
    const res: number[][] = [], path: number[] = [];
    // 接下来只能从 nums[i:] 里选
    const dfs = (i: number): void => {
        res.push([...path]);                    // 树上每个节点都是一个子集 //@record
        for (let j = i; j < nums.length; j++) { //@choose
            path.push(nums[j]);                 // 选 nums[j] //@choose
            dfs(j + 1);                         // 下一个只能从 j+1 开始选，不会重复 //@choose
            path.pop();                         // 撤销，换下一个 //@undo
        }
    };
    dfs(0);                                     //@start
    return res;                                 //@done
}
