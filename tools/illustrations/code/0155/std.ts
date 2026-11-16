class MinStack {
    private stack: number[];
    private mins: number[];                     // mins 的最后一个是当前栈里的最小值

    constructor() {
        this.stack = [];                        //@init
        this.mins = [];                         //@init
    }

    push(val: number): void {
        this.stack.push(val);                   //@push
        this.mins.push(this.mins.length ? Math.min(val, this.mins[this.mins.length - 1]) : val);   //@push
    }

    pop(): void {
        this.stack.pop();                       //@pop
        this.mins.pop();                        // 和主栈同步弹出 //@pop
    }

    top(): number {
        return this.stack[this.stack.length - 1];   //@top
    }

    getMin(): number {
        return this.mins[this.mins.length - 1];     //@getMin
    }
}
