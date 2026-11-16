function subsets(nums: number[]): number[][] {
    const res: number[][] = [], path: number[] = [];    //@init
    const dfs = (start: number): void => {
        res.push([...path]);                        // 每个节点都是一个子集 //@collect
        for (let i = start; i < nums.length; i++) {
            path.push(nums[i]);                     //@pick
            dfs(i + 1);                             // 下一个只能从后面选 //@pick
            path.pop();
        }
    };
    dfs(0);                                         //@init
    return res;                                     //@done
}
