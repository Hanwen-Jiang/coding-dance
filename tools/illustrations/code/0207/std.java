class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> graph = new ArrayList<>();         //@init
        for (int i = 0; i < numCourses; i++) {                  //@init
            graph.add(new ArrayList<>());                       //@init
        }
        int[] indeg = new int[numCourses];                      // 还有几门先修课没上 //@init
        for (int[] p : prerequisites) {                         // 先上 p[1] 才能上 p[0] //@init
            graph.get(p[1]).add(p[0]);                          //@init
            indeg[p[0]]++;                                      //@init
        }
        Deque<Integer> q = new ArrayDeque<>();                  //@init
        for (int i = 0; i < numCourses; i++) {                  //@init
            if (indeg[i] == 0) q.offer(i);                      //@init
        }
        int done = 0;                                           //@init
        while (!q.isEmpty()) {
            int b = q.poll();                                   //@take
            done++;                                             //@take
            for (int a : graph.get(b)) {                        //@take
                if (--indeg[a] == 0) {                          // 先修课都上完了 //@take
                    q.offer(a);                                 //@take
                }
            }
        }
        return done == numCourses;                              // 环上的课永远上不了 //@done
    }
}
