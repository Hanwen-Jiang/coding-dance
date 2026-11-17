class Solution {
    private final List<List<String>> res = new ArrayList<>();
    private final List<String> path = new ArrayList<>();
    private String s;

    public List<List<String>> partition(String s) {
        this.s = s;
        dfs(0);                                     //@init
        return res;                                 //@done
    }

    private void dfs(int start) {
        if (start == s.length()) {                  //@collect
            res.add(new ArrayList<>(path));         //@collect
            return;                                 //@collect
        }
        for (int end = start + 1; end <= s.length(); end++) {   //@try
            if (isPal(start, end - 1)) {            // 这一段是回文才切 //@try,cut
                path.add(s.substring(start, end));  //@cut
                dfs(end);                           //@cut
                path.remove(path.size() - 1);
            }
        }
    }

    private boolean isPal(int i, int j) {
        while (i < j) {
            if (s.charAt(i++) != s.charAt(j--)) return false;
        }
        return true;
    }
}
