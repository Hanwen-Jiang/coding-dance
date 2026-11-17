var combine = function(n, k) {
    const res = [], path = [];
    const dfs = (start) => {
        if (path.length === k) {                // 选够了 //@full
            res.push([...path]);                //@full
            return;                             //@full
        }
        const need = k - path.length;           // 还要选几个 //@choose
        for (let x = start; x <= n - need + 1; x++) {   // 剪枝：后面的数要够选 //@choose
            path.push(x);                       //@choose
            dfs(x + 1);                         //@choose
            path.pop();                         //@undo
        }
    };
    dfs(1);                                     //@start
    return res;                                 //@done
};
