class MyQueue {
    constructor() {
        this.inbox = [];                        // 新元素都压进这里 //@init
        this.outbox = [];                       // 出队都从这里弹 //@init
    }

    push(x) {
        this.inbox.push(x);                     //@push
    }

    pop() {
        this.peek();                            // 先保证 outbox 里有元素 //@pop
        return this.outbox.pop();               //@pop
    }

    peek() {
        if (!this.outbox.length) {              // outbox 空了才倒 //@move
            while (this.inbox.length) {         // 把 inbox 整个倒过来 //@move
                this.outbox.push(this.inbox.pop());     //@move
            }
        }
        return this.outbox[this.outbox.length - 1];     //@peek
    }

    empty() {
        return !this.inbox.length && !this.outbox.length;   //@empty
    }
}
