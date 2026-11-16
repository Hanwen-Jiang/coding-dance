class MinStack {
    constructor() {
        this.stack = [];                        //@init
        this.mins = [];                         // mins 的最后一个是当前栈里的最小值 //@init
    }

    push(val) {
        this.stack.push(val);                   //@push
        this.mins.push(this.mins.length ? Math.min(val, this.mins[this.mins.length - 1]) : val);   //@push
    }

    pop() {
        this.stack.pop();                       //@pop
        this.mins.pop();                        // 和主栈同步弹出 //@pop
    }

    top() {
        return this.stack[this.stack.length - 1];   //@top
    }

    getMin() {
        return this.mins[this.mins.length - 1];     //@getMin
    }
}
