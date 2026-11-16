class Solution {
    public String decodeString(String s) {
        Deque<String> prevs = new ArrayDeque<>();       //@init
        Deque<Integer> counts = new ArrayDeque<>();     //@init
        StringBuilder cur = new StringBuilder();        //@init
        int k = 0;                                      //@init
        for (char c : s.toCharArray()) {
            if (Character.isDigit(c)) {                 //@digit
                k = k * 10 + (c - '0');                 // 数字可能不止一位 //@digit
            } else if (c == '[') {                      //@push
                prevs.push(cur.toString());             // 存档：括号外的前缀和重复次数 //@push
                counts.push(k);                         //@push
                cur = new StringBuilder();              //@push
                k = 0;                                  //@push
            } else if (c == ']') {                      //@pop
                String inner = cur.toString().repeat(counts.pop());    //@pop
                cur = new StringBuilder(prevs.pop()).append(inner);    // 展开后接回前缀 //@pop
            } else {                                    //@letter
                cur.append(c);                          //@letter
            }
        }
        return cur.toString();                          //@done
    }
}
