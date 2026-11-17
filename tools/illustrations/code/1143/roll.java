class Solution {
    public int longestCommonSubsequence(String text1, String text2) {
        int n = text2.length();
        int[] prev = new int[n + 1];                    // 第 0 行：text1 取空串，全是 0 //@init
        for (char a : text1.toCharArray()) {            //@row
            int[] cur = new int[n + 1];                 // 这一行的第 0 列：text2 取空串，是 0 //@row
            for (int j = 0; j < n; j++) {
                cur[j + 1] = a == text2.charAt(j) ? prev[j] + 1 : Math.max(prev[j + 1], cur[j]);  // 左上 prev[j]，上面 prev[j+1]，左边 cur[j] //@same,diff
            }
            prev = cur;                                 // 这一行算完，成了下一行的「上一行」 //@next
        }
        return prev[n];                                 //@done
    }
}