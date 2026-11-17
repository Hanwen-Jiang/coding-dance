class Solution {
    private List<List<Integer>> rooms;
    private boolean[] seen;

    private void dfs(int u) {
        seen[u] = true;                             // 进了房间 u //@visit
        for (int v : rooms.get(u)) {                // 用房间里的钥匙 //@next
            if (!seen[v]) {                         // 没进过的才进去 //@next
                dfs(v);                             //@next
            }
        }
    }

    public boolean canVisitAllRooms(List<List<Integer>> rooms) {
        this.rooms = rooms;
        seen = new boolean[rooms.size()];
        dfs(0);                                     //@start
        for (boolean s : seen) {                    //@done
            if (!s) {                               //@done
                return false;                       //@done
            }
        }
        return true;                                //@done
    }
}
