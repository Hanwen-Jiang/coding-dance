// 图解页面是手写的（illustrations/0200.岛屿数量.html），这里只提供提示和代码，build 只跑测试、不生成页面。
module.exports = {
  id: 200, name: "岛屿数量", title: "岛屿数量图解", level: "中等", topic: "图论", handwritten: true,
  h1: "岛屿数量，一步一步看",
  lede: "扫到一块没数过的陆地就 +1，然后立刻把这整座岛淹掉，后面再扫到它的格子就直接跳过。",
  hints: [
    { t: "换个说法看题目", body: ["「数岛屿」其实就是「数有几块互相连通的陆地」。", "想象你从左上角开始，一格一格往右、往下扫。什么时候答案应该 +1？"] },
    { t: "怎么避免重复计数", body: ["扫到一块<strong>还没被数过</strong>的陆地，答案就 +1。", "同一座岛有很多格子，之后还会扫到它们。所以 +1 之后，要<strong>立刻把这座岛的所有格子都做上记号</strong>（比如直接改成 <code>'0'</code>，相当于把岛「淹掉」），以后扫到就直接跳过。"] },
    { t: "怎么找出整座岛", body: ["从刚发现的格子出发，往上、下、左、右四个方向扩散：遇到陆地就做记号并继续扩散，遇到水或者走出边界就停。", "这就是 <strong>DFS</strong>（递归或用栈）或 <strong>BFS</strong>（用队列），两种都能过。"] },
  ],
  codes: [{ t: "标准解法：DFS 淹没整座岛", code: `
class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        m, n = len(grid), len(grid[0])

        def sink(i, j):
            if not (0 <= i < m and 0 <= j < n) or grid[i][j] != '1':
                return                      # 越界或不是陆地
            grid[i][j] = '0'                # 先做记号，再扩散
            sink(i - 1, j)
            sink(i + 1, j)
            sink(i, j - 1)
            sink(i, j + 1)

        count = 0
        for i in range(m):
            for j in range(n):
                if grid[i][j] == '1':
                    count += 1
                    sink(i, j)
        return count
` }, { t: "简洁写法：sink 顺便返回 1", kind: "elegant", note: "让 sink 在淹掉一座新岛时返回 1，否则返回 0，答案就是对所有格子求和。", code: `
class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        def sink(i, j):
            if 0 <= i < len(grid) and 0 <= j < len(grid[0]) and grid[i][j] == '1':
                grid[i][j] = '0'
                for x, y in (i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1):
                    sink(x, y)
                return 1
            return 0
        return sum(sink(i, j) for i in range(len(grid)) for j in range(len(grid[0])))
` }, { t: "另一种写法：BFS", note: "递归太深担心爆栈时，用队列一圈一圈往外扩。入队时就做记号，避免同一个格子重复入队。", code: `
class Solution:
    def numIslands(self, grid: List[List[str]]) -> int:
        m, n, count = len(grid), len(grid[0]), 0
        for i in range(m):
            for j in range(n):
                if grid[i][j] != '1':
                    continue
                count += 1
                grid[i][j] = '0'
                q = deque([(i, j)])
                while q:
                    x, y = q.popleft()
                    for a, b in (x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1):
                        if 0 <= a < m and 0 <= b < n and grid[a][b] == '1':
                            grid[a][b] = '0'    # 入队时就做记号
                            q.append((a, b))
        return count
` }],
  pytest: `
s = Solution()
g = lambda rows: [list(r) for r in rows]
assert s.numIslands(g(["11110","11010","11000","00000"])) == 1
assert s.numIslands(g(["11000","11000","00100","00011"])) == 3
assert s.numIslands(g(["0"])) == 0
assert s.numIslands(g(["1"])) == 1
assert s.numIslands(g(["101","010","101"])) == 5
`,
  points: [
    { t: "先判断再递归", body: "进 <code>sink</code> 第一件事就是判断越界和是不是陆地，四个方向就不用各写一遍判断。" },
    { t: "先做记号再扩散", body: "记号要在扩散之前做，否则两个相邻格子会互相跳来跳去，死循环。" },
    { t: "格子是字符", body: "<code>grid</code> 里存的是字符 <code>'1'</code> 和 <code>'0'</code>，不是数字。" },
    { t: "复杂度", body: "每个格子最多被访问常数次，时间 O(m·n)；最坏情况下递归深度也是 O(m·n)。" },
  ],
};
