function longestValidParentheses(s: string): number {
    const stack: number[] = [-1];                   // 栈底：最后一个没匹配上的位置 //@init
    let best = 0;                                   //@init
    for (let i = 0; i < s.length; i++) {
        if (s[i] === "(") {                         //@open
            stack.push(i);                          //@open
        } else {                                    //@lone,match
            stack.pop();                            //@lone,match
            if (!stack.length) {                    // 这个 ) 没人匹配，成为新的分界线 //@lone,match
                stack.push(i);                      //@lone
            } else {                                //@match
                best = Math.max(best, i - stack[stack.length - 1]);     //@match
            }
        }
    }
    return best;                                    //@done
}
