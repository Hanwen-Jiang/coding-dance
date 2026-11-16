var combinationSum = function(candidates, target) {
    candidates.sort((a, b) => a - b);               //@init
    const res = [], path = [];                      //@init
    const dfs = (start, remain) => {
        if (remain === 0) {                         //@found
            res.push([...path]);                    //@found
            return;                                 //@found
        }
        for (let i = start; i < candidates.length; i++) {
            if (candidates[i] > remain) {           // 排过序，后面的只会更大 //@prune
                break;                              //@prune
            }
            path.push(candidates[i]);               //@pick
            dfs(i, remain - candidates[i]);         // 还从 i 开始：可以重复选 //@pick
            path.pop();
        }
    };
    dfs(0, target);                                 //@init
    return res;                                     //@done
};
