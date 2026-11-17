class Solution {
    public int[] findOrder(int numCourses, int[][] prerequisites) {
        List<List<Integer>> graph = new ArrayList<>();      // 先修课 -> 后续课 //@init
        for (int i = 0; i < numCourses; i++) {              //@init
            graph.add(new ArrayList<>());                   //@init
        }
        int[] indeg = new int[numCourses];                  // 还差几门先修课 //@init
        for (int[] p : prerequisites) {                     // 学 p[0] 之前要先学 p[1]：边 p[1] -> p[0] //@init
            graph.get(p[1]).add(p[0]);                      //@init
            indeg[p[0]]++;                                  //@init
        }
        Deque<Integer> q = new ArrayDeque<>();              // 现在就能学的课 //@start
        for (int i = 0; i < numCourses; i++) {              //@start
            if (indeg[i] == 0) q.offer(i);                  //@start
        }
        int[] order = new int[numCourses];
        int k = 0;
        while (!q.isEmpty()) {
            int u = q.poll();                               //@pop
            order[k++] = u;                                 //@pop
            for (int v : graph.get(u)) {                    // 学完 u，后续课少了一门先修 //@next
                if (--indeg[v] == 0) {                      // 先修课都学完了 //@next,ready
                    q.offer(v);                             //@ready
                }
            }
        }
        return k == numCourses ? order : new int[0];        // 少了说明有环 //@done
    }
}
