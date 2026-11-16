class Solution {
    public int longestValidParentheses(String s) {
        Deque<Integer> stack = new ArrayDeque<>();      // 栈底：最后一个没匹配上的位置 //@init
        stack.push(-1);                                 //@init
        int best = 0;                                   //@init
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == '(') {                   //@open
                stack.push(i);                          //@open
            } else {                                    //@lone,match
                stack.pop();                            //@lone,match
                if (stack.isEmpty()) {                  // 这个 ) 没人匹配，成为新的分界线 //@lone,match
                    stack.push(i);                      //@lone
                } else {                                //@match
                    best = Math.max(best, i - stack.peek());    //@match
                }
            }
        }
        return best;                                    //@done
    }
}
