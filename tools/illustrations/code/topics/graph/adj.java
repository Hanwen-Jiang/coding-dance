class Solution {
    public boolean validPath(int n, int[][] edges, int source, int destination) {
        List<List<Integer>> graph = new ArrayList<>();      // graph.get(u) 是 u 的所有邻居 //@init
        for (int i = 0; i < n; i++) {                       //@init
            graph.add(new ArrayList<>());                   //@init
        }
        for (int[] e : edges) {                             //@edge
            graph.get(e[0]).add(e[1]);                      // 无向图：两个方向都要加 //@edge
            graph.get(e[1]).add(e[0]);                      //@edge
        }
        boolean[] seen = new boolean[n];                    //@start
        seen[source] = true;                                //@start
        Deque<Integer> stack = new ArrayDeque<>();          //@start
        stack.push(source);                                 //@start
        while (!stack.isEmpty()) {
            int u = stack.pop();                            //@pop
            if (u == destination) {                         //@found
                return true;                                //@found
            }
            for (int v : graph.get(u)) {                    // 只看和 u 相连的点 //@next
                if (!seen[v]) {                             //@next
                    seen[v] = true;                         //@next
                    stack.push(v);                          //@next
                }
            }
        }
        return false;                                       //@done
    }
}
