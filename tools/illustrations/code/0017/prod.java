class Solution {
    public List<String> letterCombinations(String digits) {
        if (digits.isEmpty()) {                         //@empty
            return new ArrayList<>();                   //@empty
        }
        String[] phone = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};    //@init
        List<String> combos = new ArrayList<>(List.of(""));     // 一开始只有一个空前缀 //@init
        for (char d : digits.toCharArray()) {           //@mul
            List<String> next = new ArrayList<>();      //@mul
            for (String c : combos) {                   //@mul
                for (char ch : phone[d - '0'].toCharArray()) {  //@mul
                    next.add(c + ch);                   // 每个前缀后面接上这一位的每个字母 //@mul
                }
            }
            combos = next;                              //@mul
        }
        return combos;                                  //@done
    }
}
