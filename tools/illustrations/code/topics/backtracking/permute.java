class Solution {
    private final List<List<Integer>> res = new ArrayList<>();
    private final List<Integer> path = new ArrayList<>();
    private boolean[] used;
    private int[] nums;

    private void dfs() {
        if (path.size() == nums.length) {       // 放满了：一个排列 //@full
            res.add(new ArrayList<>(path));     //@full
            return;                             //@full
        }
        for (int j = 0; j < nums.length; j++) { // 每个位置可以放任何一个还没用过的数 //@choose
            if (used[j]) {                      //@choose
                continue;                       //@choose
            }
            used[j] = true;                     //@choose
            path.add(nums[j]);                  //@choose
            dfs();                              //@choose
            path.remove(path.size() - 1);       // 撤销 //@undo
            used[j] = false;                    //@undo
        }
    }

    public List<List<Integer>> permute(int[] nums) {
        this.nums = nums;
        used = new boolean[nums.length];
        dfs();                                  //@start
        return res;                             //@done
    }
}
