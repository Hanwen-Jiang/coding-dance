class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, (x, y) -> x[0] - y[0]);     // 先按起点排 //@sort
        List<int[]> res = new ArrayList<>();                //@sort
        for (int[] cur : intervals) {
            int a = cur[0], b = cur[1];
            if (!res.isEmpty() && a <= res.get(res.size() - 1)[1]) {    //@merge
                int[] last = res.get(res.size() - 1);       //@merge
                last[1] = Math.max(last[1], b);             // 重叠，延长终点 //@merge
            } else {
                res.add(new int[]{a, b});                   // 不重叠，另起一段 //@new
            }
        }
        return res.toArray(new int[0][]);                   //@done
    }
}
