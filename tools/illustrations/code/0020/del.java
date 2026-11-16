class Solution {
    public boolean isValid(String s) {
        while (s.contains("()") || s.contains("[]") || s.contains("{}")) {     //@round
            s = s.replace("()", "").replace("[]", "").replace("{}", "");       //@del
        }
        return s.isEmpty();                             //@done
    }
}
