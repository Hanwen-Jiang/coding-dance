class Solution {
    private final List<List<Integer>> res = new ArrayList<>();
    private final List<Integer> path = new ArrayList<>();
    private int n, k;

    private void dfs(int start) {
        if (path.size() == k) {                 // 选够了 //@full
            res.add(new ArrayList<>(path));     //@full
            return;                             //@full
        }
        int need = k - path.size();             // 还要选几个 //@choose
        for (int x = start; x <= n - need + 1; x++) {   // 剪枝：后面的数要够选 //@choose
            path.add(x);                        //@choose
            dfs(x + 1);                         //@choose
            path.remove(path.size() - 1);       //@undo
        }
    }

    public List<List<Integer>> combine(int n, int k) {
        this.n = n;
        this.k = k;
        dfs(1);                                 //@start
        return res;                             //@done
    }
}
