var permute = function(nums) {
    const res = [], path = [], used = new Array(nums.length).fill(false);
    const dfs = () => {
        if (path.length === nums.length) {      // 放满了：一个排列 //@full
            res.push([...path]);                //@full
            return;                             //@full
        }
        for (let j = 0; j < nums.length; j++) { // 每个位置可以放任何一个还没用过的数 //@choose
            if (used[j]) {                      //@choose
                continue;                       //@choose
            }
            used[j] = true;                     //@choose
            path.push(nums[j]);                 //@choose
            dfs();                              //@choose
            path.pop();                         // 撤销 //@undo
            used[j] = false;                    //@undo
        }
    };
    dfs();                                      //@start
    return res;                                 //@done
};
