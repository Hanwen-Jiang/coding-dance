class Solution {
    public List<List<Integer>> permute(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();                    //@init
        dfs(nums, new ArrayList<>(), new boolean[nums.length], res);    //@init
        return res;                                                     //@done
    }

    private void dfs(int[] nums, List<Integer> path, boolean[] used, List<List<Integer>> res) {
        if (path.size() == nums.length) {                               //@collect
            res.add(new ArrayList<>(path));                             //@collect
            return;                                                     //@collect
        }
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) {
                continue;
            }
            used[i] = true;                                             //@choose
            path.add(nums[i]);                                          //@choose
            dfs(nums, path, used, res);
            path.remove(path.size() - 1);                               // 撤销选择
            used[i] = false;
        }
    }
}
