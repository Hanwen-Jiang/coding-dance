var dailyTemperatures = function(temperatures) {
    const T = temperatures, n = T.length;       //@init
    const ans = new Array(n).fill(0);           //@init
    for (let i = n - 2; i >= 0; i--) {          //@start
        let j = i + 1;                          //@start
        while (T[j] <= T[i] && ans[j]) {        //@jump
            j += ans[j];                        // 跳到比 T[j] 更热的那天 //@jump
        }
        if (T[j] > T[i]) {                      //@found,miss
            ans[i] = j - i;                     //@found
        }
    }
    return ans;                                 //@done
};
