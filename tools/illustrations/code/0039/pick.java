class Solution {
    private int[] candidates;

    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        this.candidates = candidates;
        return dfs(0, target);                              //@start
    }

    // 从下标 i 往后选，凑出 remain 的所有组合
    private List<List<Integer>> dfs(int i, int remain) {
        List<List<Integer>> res = new ArrayList<>();
        if (remain == 0) {                                  //@found
            res.add(new ArrayList<>());                     //@found
            return res;                                     //@found
        }
        if (i == candidates.length || remain < 0) {         //@empty
            return res;                                     //@empty
        }
        int c = candidates[i];                              //@take
        for (List<Integer> rest : dfs(i, remain - c)) {     // 再选一次 c //@take
            rest.add(0, c);                                 //@take
            res.add(rest);                                  //@take
        }
        res.addAll(dfs(i + 1, remain));                     // 以后都不选 c //@skip
        return res;
    }
}
