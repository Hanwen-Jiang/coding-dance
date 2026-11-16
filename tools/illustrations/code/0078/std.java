class Solution {
    private List<List<Integer>> res = new ArrayList<>();    //@init
    private List<Integer> path = new ArrayList<>();         //@init
    private int[] nums;

    public List<List<Integer>> subsets(int[] nums) {
        this.nums = nums;
        dfs(0);                                             //@init
        return res;                                         //@done
    }

    private void dfs(int start) {
        res.add(new ArrayList<>(path));                     // 每个节点都是一个子集 //@collect
        for (int i = start; i < nums.length; i++) {
            path.add(nums[i]);                              //@pick
            dfs(i + 1);                                     // 下一个只能从后面选 //@pick
            path.remove(path.size() - 1);
        }
    }
}
