class MyQueue {
    stack<int> inbox;                           // 新元素都压进这里 //@init
    stack<int> outbox;                          // 出队都从这里弹 //@init

public:
    MyQueue() {}

    void push(int x) {
        inbox.push(x);                          //@push
    }

    int pop() {
        int x = peek();                         // 先保证 outbox 里有元素 //@pop
        outbox.pop();                           //@pop
        return x;                               //@pop
    }

    int peek() {
        if (outbox.empty()) {                   // outbox 空了才倒 //@move
            while (!inbox.empty()) {            // 把 inbox 整个倒过来 //@move
                outbox.push(inbox.top());       //@move
                inbox.pop();                    //@move
            }
        }
        return outbox.top();                    //@peek
    }

    bool empty() {
        return inbox.empty() && outbox.empty(); //@empty
    }
};
