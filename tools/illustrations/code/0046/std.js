var permute = function(nums) {
    const res = [], path = [], used = new Array(nums.length).fill(false);  //@init
    const dfs = () => {
        if (path.length === nums.length) {          //@collect
            res.push(path.slice());                 //@collect
            return;                                 //@collect
        }
        for (let i = 0; i < nums.length; i++) {
            if (used[i]) {
                continue;
            }
            used[i] = true;                         //@choose
            path.push(nums[i]);                     //@choose
            dfs();
            path.pop();                             // 撤销选择
            used[i] = false;
        }
    };
    dfs();                                          //@init
    return res;                                     //@done
};
