function combinationSum(candidates: number[], target: number): number[][] {
    const dfs = (i: number, remain: number): number[][] => {
        if (remain === 0) {                         //@found
            return [[]];                            //@found
        }
        if (i === candidates.length || remain < 0) {    //@empty
            return [];                              //@empty
        }
        const c = candidates[i];                    //@take
        return dfs(i, remain - c).map((rest) => [c, ...rest]).concat(dfs(i + 1, remain));    //@take,skip
    };
    return dfs(0, target);                          //@start
}
