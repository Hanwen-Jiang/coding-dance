class Solution {
    private List<List<Integer>> graph;
    private int[] state;

    public boolean canFinish(int numCourses, int[][] prerequisites) {
        graph = new ArrayList<>();                              //@init
        for (int i = 0; i < numCourses; i++) {                  //@init
            graph.add(new ArrayList<>());                       //@init
        }
        for (int[] p : prerequisites) {                         //@init
            graph.get(p[0]).add(p[1]);                          //@init
        }
        state = new int[numCourses];                            // 0 没访问，1 在递归路径上，2 确认没问题 //@init
        for (int u = 0; u < numCourses; u++) {                  //@init,done
            if (!ok(u)) {                                       //@init,done
                return false;                                   //@done
            }
        }
        return true;                                            //@done
    }

    private boolean ok(int u) {
        if (state[u] != 0) {                                    //@seen,cycle
            return state[u] == 2;                               //@seen,cycle
        }
        state[u] = 1;                                           //@enter
        for (int v : graph.get(u)) {                            //@enter
            if (!ok(v)) {                                       //@enter
                return false;                                   //@cycle
            }
        }
        state[u] = 2;                                           //@confirm
        return true;                                            //@confirm
    }
}
