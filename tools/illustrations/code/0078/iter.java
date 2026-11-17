class Solution {
    public List<List<Integer>> subsets(int[] nums) {
        List<List<Integer>> res = new ArrayList<>();        //@init
        res.add(new ArrayList<>());                         //@init
        for (int x : nums) {
            int size = res.size();                          // 只复制已有的子集 //@add
            for (int k = 0; k < size; k++) {                //@add
                List<Integer> s = new ArrayList<>(res.get(k));  //@add
                s.add(x);                                   //@add
                res.add(s);                                 //@add
            }
        }
        return res;                                         //@done
    }
}
