class Solution {
    public List<List<Integer>> generate(int numRows) {
        List<List<Integer>> res = new ArrayList<>();    //@init
        for (int i = 0; i < numRows; i++) {             //@row
            List<Integer> row = new ArrayList<>(Collections.nCopies(i + 1, 1));     // 首尾是 1 //@row
            for (int j = 1; j < i; j++) {               //@mid
                row.set(j, res.get(i - 1).get(j - 1) + res.get(i - 1).get(j));     //@mid
            }
            res.add(row);                               //@row
        }
        return res;                                     //@done
    }
}
