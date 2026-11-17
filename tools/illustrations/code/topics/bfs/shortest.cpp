class Solution {
public:
    int nearestExit(vector<vector<char>>& maze, vector<int>& entrance) {
        int m = maze.size(), n = maze[0].size();
        const int dirs[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        queue<array<int, 3>> q;                                 // {行, 列, 走了几步} //@init
        q.push({entrance[0], entrance[1], 0});                  //@init
        maze[entrance[0]][entrance[1]] = '+';                   // 走过的格子标成墙，不再走 //@init
        while (!q.empty()) {
            auto [i, j, d] = q.front();                         //@pop
            q.pop();                                            //@pop
            for (auto& dir : dirs) {                            //@next
                int a = i + dir[0], b = j + dir[1];             //@next
                if (a >= 0 && a < m && b >= 0 && b < n && maze[a][b] == '.') {  //@next
                    if (a == 0 || a == m - 1 || b == 0 || b == n - 1) {     // 到了边上：就是出口 //@exit
                        return d + 1;                           //@exit
                    }
                    maze[a][b] = '+';                           // 入队时就标记 //@push
                    q.push({a, b, d + 1});                      //@push
                }
            }
        }
        return -1;                                              //@done
    }
};
