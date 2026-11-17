class Solution {
    private static final String[] PHONE = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};
    private List<String> res;
    private StringBuilder path;
    private String digits;

    public List<String> letterCombinations(String digits) {
        res = new ArrayList<>();
        if (digits.isEmpty()) {
            return res;
        }
        this.digits = digits;                           //@init
        path = new StringBuilder();                     //@init
        dfs(0);                                         //@init
        return res;                                     //@done
    }

    private void dfs(int i) {
        if (i == digits.length()) {                     //@record
            res.add(path.toString());                   //@record
            return;                                     //@record
        }
        for (char ch : PHONE[digits.charAt(i) - '0'].toCharArray()) {   //@pick
            path.append(ch);                            // 选 //@pick
            dfs(i + 1);                                 // 往下 //@pick
            path.deleteCharAt(path.length() - 1);       // 撤销 //@undo
        }
    }
}
