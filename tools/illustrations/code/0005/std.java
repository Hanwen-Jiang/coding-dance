class Solution {
    public String longestPalindrome(String s) {
        int start = 0, end = 0;                             //@init
        for (int i = 0; i < s.length(); i++) {
            for (int[] p : new int[][]{expand(s, i, i), expand(s, i, i + 1)}) {    // 奇数中心、偶数中心 //@grow,miss
                if (p[1] - p[0] > end - start) {            //@grow,update
                    start = p[0];                           //@update
                    end = p[1];                             //@update
                }
            }
        }
        return s.substring(start, end + 1);                 //@done
    }

    private int[] expand(String s, int l, int r) {
        while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) {   //@grow,miss
            l--;                                            //@grow
            r++;                                            //@grow
        }
        return new int[]{l + 1, r - 1};                     // 退回最后一次成功的位置 //@grow
    }
}
