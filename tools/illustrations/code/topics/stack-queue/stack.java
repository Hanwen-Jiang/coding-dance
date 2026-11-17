class Solution {
    public int evalRPN(String[] tokens) {
        Deque<Integer> stack = new ArrayDeque<>();      //@init
        for (String t : tokens) {                       //@loop
            if (t.length() > 1 || Character.isDigit(t.charAt(0))) {     // 长度大于 1 的一定是数字，比如 "-11" //@push
                stack.push(Integer.parseInt(t));        // 数字直接压栈 //@push
                continue;                               //@push
            }
            int b = stack.pop();                        // 先弹出的是右边的数 //@pop
            int a = stack.pop();                        //@pop
            switch (t) {                                //@calc
                case "+": stack.push(a + b); break;     //@calc
                case "-": stack.push(a - b); break;     //@calc
                case "*": stack.push(a * b); break;     //@calc
                default: stack.push(a / b);             // 整数除法本来就向零取整 //@calc
            }
        }
        return stack.pop();                             //@done
    }
}
