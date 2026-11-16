class Solution {
    public List<Integer> partitionLabels(String s) {
        int[] last = new int[26];                       // 每个字母最后出现的位置 //@init
        for (int i = 0; i < s.length(); i++) last[s.charAt(i) - 'a'] = i;  //@init
        List<Integer> res = new ArrayList<>();          //@init
        int start = 0, end = 0;                         //@init
        for (int i = 0; i < s.length(); i++) {          //@grow
            end = Math.max(end, last[s.charAt(i) - 'a']);   // 这一段至少要到 end //@grow
            if (i == end) {                             // 走到边界，切一刀 //@cut
                res.add(end - start + 1);               //@cut
                start = i + 1;                          //@cut
            }
        }
        return res;                                     //@done
    }
}
