class Solution {
    private final List<List<Integer>> res = new ArrayList<>();
    private final List<Integer> path = new ArrayList<>();
    private int[] nums;

    // 接下来只能从 nums[i:] 里选
    private void dfs(int i) {
        res.add(new ArrayList<>(path));         // 树上每个节点都是一个子集 //@record
        for (int j = i; j < nums.length; j++) { //@choose
            path.add(nums[j]);                  // 选 nums[j] //@choose
            dfs(j + 1);                         // 下一个只能从 j+1 开始选，不会重复 //@choose
            path.remove(path.size() - 1);       // 撤销，换下一个 //@undo
        }
    }

    public List<List<Integer>> subsets(int[] nums) {
        this.nums = nums;
        dfs(0);                                 //@start
        return res;                             //@done
    }
}
