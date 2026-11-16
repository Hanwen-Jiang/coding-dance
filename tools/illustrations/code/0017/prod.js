var letterCombinations = function(digits) {
    if (!digits) {                                  //@empty
        return [];                                  //@empty
    }
    const phone = { 2: "abc", 3: "def", 4: "ghi", 5: "jkl", 6: "mno", 7: "pqrs", 8: "tuv", 9: "wxyz" };  //@init
    let combos = [""];                              // 一开始只有一个空前缀 //@init
    for (const d of digits) {                       //@mul
        combos = combos.flatMap((c) => [...phone[d]].map((ch) => c + ch));     // 每个前缀后面接上这一位的每个字母 //@mul
    }
    return combos;                                  //@done
};
