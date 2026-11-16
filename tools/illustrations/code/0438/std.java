class Solution {
    public List<Integer> findAnagrams(String s, String p) {
        int m = p.length();                                 //@init
        List<Integer> res = new ArrayList<>();              //@init
        int[] need = new int[26], win = new int[26];        // 每个字母出现的次数 //@init
        for (char c : p.toCharArray()) {                    //@init
            need[c - 'a']++;                                //@init
        }
        for (int r = 0; r < s.length(); r++) {
            win[s.charAt(r) - 'a']++;                       // 右边进 //@in
            if (r >= m) {
                win[s.charAt(r - m) - 'a']--;               // 左边出 //@out
            }
            if (Arrays.equals(win, need)) {                 //@cmp
                res.add(r - m + 1);                         //@hit
            }
        }
        return res;                                         //@done
    }
}
