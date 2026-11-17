var canVisitAllRooms = function(rooms) {
    const seen = new Array(rooms.length).fill(false);
    const dfs = (u) => {
        seen[u] = true;                             // 进了房间 u //@visit
        for (const v of rooms[u]) {                 // 用房间里的钥匙 //@next
            if (!seen[v]) {                         // 没进过的才进去 //@next
                dfs(v);                             //@next
            }
        }
    };
    dfs(0);                                         //@start
    return seen.every(Boolean);                     //@done
};
