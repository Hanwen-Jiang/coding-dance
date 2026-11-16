class Solution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> last = new HashMap<>();     //@init
        int left = 0, best = 0;                             //@init
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (last.getOrDefault(c, -1) >= left) {         // c 在窗口里出现过 //@jump,grow
                left = last.get(c) + 1;                     //@jump
            }
            last.put(c, i);                                 //@jump,grow
            best = Math.max(best, i - left + 1);            //@jump,grow
        }
        return best;                                        //@done
    }
}
