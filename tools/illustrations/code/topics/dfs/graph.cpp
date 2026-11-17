class Solution {
public:
    bool canVisitAllRooms(vector<vector<int>>& rooms) {
        vector<bool> seen(rooms.size(), false);
        function<void(int)> dfs = [&](int u) {
            seen[u] = true;                         // 进了房间 u //@visit
            for (int v : rooms[u]) {                // 用房间里的钥匙 //@next
                if (!seen[v]) {                     // 没进过的才进去 //@next
                    dfs(v);                         //@next
                }
            }
        };
        dfs(0);                                     //@start
        return all_of(seen.begin(), seen.end(), [](bool s) { return s; });     //@done
    }
};
