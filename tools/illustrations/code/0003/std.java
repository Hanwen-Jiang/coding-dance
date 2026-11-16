class Solution {
    public int lengthOfLongestSubstring(String s) {
        Set<Character> seen = new HashSet<>();      // 窗口里的字符 //@init
        int l = 0, best = 0;                        //@init
        for (int r = 0; r < s.length(); r++) {
            char ch = s.charAt(r);
            while (seen.contains(ch)) {             // 有重复，左端收缩 //@shrink
                seen.remove(s.charAt(l));           //@shrink
                l++;                                //@shrink
            }
            seen.add(ch);                           //@grow
            best = Math.max(best, r - l + 1);       //@grow
        }
        return best;                                //@done
    }
}
