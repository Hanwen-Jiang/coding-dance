class Solution {
    public boolean isValid(String s) {
        Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');    //@init
        Deque<Character> stack = new ArrayDeque<>();    //@init
        for (char ch : s.toCharArray()) {
            if (pairs.containsKey(ch)) {                // 右括号 //@match
                if (stack.isEmpty() || stack.pop() != (char) pairs.get(ch)) {  //@match
                    return false;                       //@bad
                }
            } else {                                    // 左括号 //@push
                stack.push(ch);                         //@push
            }
        }
        return stack.isEmpty();                         //@done
    }
}
