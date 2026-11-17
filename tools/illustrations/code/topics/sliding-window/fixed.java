class Solution {
    private boolean isVowel(char c) {
        return "aeiou".indexOf(c) >= 0;
    }

    public int maxVowels(String s, int k) {
        int cnt = 0;
        for (int i = 0; i < k; i++) {               // 第一个窗口 //@init
            if (isVowel(s.charAt(i))) cnt++;        //@init
        }
        int best = cnt;                             //@init
        for (int i = k; i < s.length(); i++) {      // 窗口右移一格 //@slide
            if (isVowel(s.charAt(i))) cnt++;        // 进来 s[i] //@slide
            if (isVowel(s.charAt(i - k))) cnt--;    // 出去 s[i-k] //@slide
            best = Math.max(best, cnt);             //@slide
        }
        return best;                                //@done
    }
}
