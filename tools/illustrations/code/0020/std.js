var isValid = function(s) {
    const pairs = { ")": "(", "]": "[", "}": "{" }; //@init
    const stack = [];                               //@init
    for (const ch of s) {
        if (ch in pairs) {                          // 右括号 //@match
            if (!stack.length || stack.pop() !== pairs[ch]) {   //@match
                return false;                       //@bad
            }
        } else {                                    // 左括号 //@push
            stack.push(ch);                         //@push
        }
    }
    return stack.length === 0;                      //@done
};
