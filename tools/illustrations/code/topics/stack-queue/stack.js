var evalRPN = function(tokens) {
    const stack = [];                               //@init
    for (const t of tokens) {                       //@loop
        if (!["+", "-", "*", "/"].includes(t)) {    //@push
            stack.push(Number(t));                  // 数字直接压栈 //@push
            continue;                               //@push
        }
        const b = stack.pop();                      // 先弹出的是右边的数 //@pop
        const a = stack.pop();                      //@pop
        if (t === "+") {                            //@calc
            stack.push(a + b);                      //@calc
        } else if (t === "-") {                     //@calc
            stack.push(a - b);                      //@calc
        } else if (t === "*") {                     //@calc
            stack.push(a * b);                      //@calc
        } else {                                    //@calc
            stack.push(Math.trunc(a / b));          // 向零取整 //@calc
        }
    }
    return stack[0];                                //@done
};
