class MyQueue {
    private final Deque<Integer> inbox = new ArrayDeque<>();     // 新元素都压进这里 //@init
    private final Deque<Integer> outbox = new ArrayDeque<>();    // 出队都从这里弹 //@init

    public void push(int x) {
        inbox.push(x);                          //@push
    }

    public int pop() {
        peek();                                 // 先保证 outbox 里有元素 //@pop
        return outbox.pop();                    //@pop
    }

    public int peek() {
        if (outbox.isEmpty()) {                 // outbox 空了才倒 //@move
            while (!inbox.isEmpty()) {          // 把 inbox 整个倒过来 //@move
                outbox.push(inbox.pop());       //@move
            }
        }
        return outbox.peek();                   //@peek
    }

    public boolean empty() {
        return inbox.isEmpty() && outbox.isEmpty();     //@empty
    }
}
