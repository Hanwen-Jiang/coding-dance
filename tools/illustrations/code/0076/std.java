class Solution {
    public String minWindow(String s, String t) {
        int[] need = new int[128];                  // 每种字符还差几个 //@init
        for (char c : t.toCharArray()) need[c]++;   //@init
        int missing = t.length();                   // 一共还差几个 //@init
        int l = 0, start = 0;                       //@init
        int size = Integer.MAX_VALUE;               //@init
        for (int r = 0; r < s.length(); r++) {      //@grow
            char ch = s.charAt(r);                  //@grow
            if (need[ch] > 0) {                     //@grow
                missing--;                          //@grow
            }
            need[ch]--;                             //@grow
            while (missing == 0) {                  // 窗口合格，尝试收缩 //@shrink
                if (r - l + 1 < size) {             //@shrink
                    start = l;                      //@shrink
                    size = r - l + 1;               //@shrink
                }
                need[s.charAt(l)]++;                //@shrink
                if (need[s.charAt(l)] > 0) {        //@shrink
                    missing++;                      //@broke
                }
                l++;                                //@shrink
            }
        }
        return size == Integer.MAX_VALUE ? "" : s.substring(start, start + size);   //@done
    }
}
