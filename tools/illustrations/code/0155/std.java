class MinStack {
    private Deque<Integer> stack;
    private Deque<Integer> mins;                // mins 的栈顶是当前栈里的最小值

    public MinStack() {
        stack = new ArrayDeque<>();             //@init
        mins = new ArrayDeque<>();              //@init
    }

    public void push(int val) {
        stack.push(val);                        //@push
        mins.push(mins.isEmpty() ? val : Math.min(val, mins.peek()));  //@push
    }

    public void pop() {
        stack.pop();                            //@pop
        mins.pop();                             // 和主栈同步弹出 //@pop
    }

    public int top() {
        return stack.peek();                    //@top
    }

    public int getMin() {
        return mins.peek();                     //@getMin
    }
}
