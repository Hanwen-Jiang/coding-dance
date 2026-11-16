class Solution {
    private List<List<Integer>> res = new ArrayList<>();    //@init
    private List<Integer> path = new ArrayList<>();         //@init
    private int[] candidates;

    public List<List<Integer>> combinationSum(int[] candidates, int target) {
        Arrays.sort(candidates);                            //@init
        this.candidates = candidates;
        dfs(0, target);                                     //@init
        return res;                                         //@done
    }

    private void dfs(int start, int remain) {
        if (remain == 0) {                                  //@found
            res.add(new ArrayList<>(path));                 //@found
            return;                                         //@found
        }
        for (int i = start; i < candidates.length; i++) {
            if (candidates[i] > remain) {                   // 排过序，后面的只会更大 //@prune
                break;                                      //@prune
            }
            path.add(candidates[i]);                        //@pick
            dfs(i, remain - candidates[i]);                 // 还从 i 开始：可以重复选 //@pick
            path.remove(path.size() - 1);
        }
    }
}
