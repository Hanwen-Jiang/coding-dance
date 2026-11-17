class Solution {
    private int[] color;                        // 0 没走过，1 正在走（在递归栈上），2 安全
    private List<List<Integer>> graph;

    private boolean safe(int u) {
        if (color[u] != 0) {                    // 走过了：1 说明绕回来了，有环 //@seen
            return color[u] == 2;               //@seen
        }
        color[u] = 1;                           //@enter
        for (int v : graph.get(u)) {            //@next
            if (!safe(v)) {                     // 能走到环上，u 也不安全 //@next
                return false;                   //@next
            }
        }
        color[u] = 2;                           // 走出去的路都安全 //@safe
        return true;                            //@safe
    }

    public List<Integer> eventualSafeNodes(List<List<Integer>> graph) {
        this.graph = graph;
        color = new int[graph.size()];          //@init
        List<Integer> res = new ArrayList<>();  //@done
        for (int u = 0; u < graph.size(); u++) {    //@done
            if (safe(u)) res.add(u);            //@done
        }
        return res;                             //@done
    }
}
