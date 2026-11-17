var letterCombinations = function(digits) {
    if (!digits) {
        return [];
    }
    const phone = { 2: "abc", 3: "def", 4: "ghi", 5: "jkl", 6: "mno", 7: "pqrs", 8: "tuv", 9: "wxyz" };  //@init
    const res = [], path = [];                      //@init
    const dfs = (i) => {
        if (i === digits.length) {                  //@record
            res.push(path.join(""));                //@record
            return;                                 //@record
        }
        for (const ch of phone[digits[i]]) {        //@pick
            path.push(ch);                          // 选 //@pick
            dfs(i + 1);                             // 往下 //@pick
            path.pop();                             // 撤销 //@undo
        }
    };
    dfs(0);                                         //@init
    return res;                                     //@done
};
