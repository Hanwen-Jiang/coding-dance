const F = require("../fig");

module.exports = {
  id: 79, name: "单词搜索", title: "单词搜索图解", level: "中等", topic: "回溯",
  h1: "单词搜索，走过的格子先占住",
  lede: "从每个格子出发，按单词的字母一个一个往相邻格子走。走过的格子要临时标记，防止同一个格子用两次；这条路走不通，退回来时再把标记去掉。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "word2.jpg": [F.grid([["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], { label: "ABCCED：A → B → C → C → E → D", cls: (v, i, j) => ([[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 1]].some(([x, y]) => x === i && y === j) ? "e" : "") })],
    "word-1.jpg": [F.grid([["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], { label: "SEE：S → E → E", cls: (v, i, j) => ([[1, 3], [2, 3], [2, 2]].some(([x, y]) => x === i && y === j) ? "e" : "") })],
    "word3.jpg": [F.grid([["A", "B", "C", "E"], ["S", "F", "C", "S"], ["A", "D", "E", "E"]], { label: "ABCB：走完 A → B → C 后要回到 B，但它已经用过了，同一个格子不能用两次", cls: (v, i, j) => (i === 0 && j < 3 ? (j === 1 ? "w" : "e") : "") })],
  },
  hints: [
    { t: "从哪里开始", body: ["单词的第一个字母可能出现在任何格子，所以每个格子都要当一次起点试试。"] },
    { t: "dfs(i, j, k) 做什么", body: ["判断格子 <code>(i, j)</code> 是不是 <code>word[k]</code>。不是就返回 False；是并且 <code>k</code> 已经是最后一个字母，就返回 True。", "否则往上下左右四个方向找 <code>word[k + 1]</code>。"] },
    { t: "同一个格子不能用两次", body: ["进入格子时把它改成 <code>'#'</code>，四个方向都试完后再改回原来的字母。", "这就是回溯：改动只在这条路径上有效，退回来时要还原。"] },
  ],
  codes: [{ t: "标准解法：回溯 + 原地标记", code: `
class Solution:
    def exist(self, board: List[List[str]], word: str) -> bool:
        m, n = len(board), len(board[0])        #@init

        def dfs(i, j, k):
            if board[i][j] != word[k]:          #@match
                return False
            if k == len(word) - 1:              #@found
                return True                     #@found
            board[i][j] = "#"                   # 占住这个格子 #@match
            for x, y in (i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1):    #@match
                if 0 <= x < m and 0 <= y < n and dfs(x, y, k + 1):      #@match
                    board[i][j] = word[k]
                    return True
            board[i][j] = word[k]               # 回溯：还原 #@back
            return False                        #@back

        for i in range(m):                      #@start
            for j in range(n):                  #@start
                if dfs(i, j, 0):                #@start
                    return True                 #@yes
        return False                            #@no
` }, { t: "简洁写法：any 串起四个方向", kind: "elegant", note: "越界判断也放进 dfs 开头，四个方向就可以直接交给 any。any 碰到第一个 True 就停，不会多搜。", code: `
class Solution:
    def exist(self, board: List[List[str]], word: str) -> bool:
        def dfs(i, j, k):
            if not (0 <= i < len(board) and 0 <= j < len(board[0])) or board[i][j] != word[k]:
                return False
            if k == len(word) - 1:
                return True
            board[i][j] = "#"
            found = any(dfs(x, y, k + 1) for x, y in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)))
            board[i][j] = word[k]
            return found
        return any(dfs(i, j, 0) for i in range(len(board)) for j in range(len(board[0])))
` }],
  pytest: `
s = Solution()
b = lambda: [list("ABCE"), list("SFCS"), list("ADEE")]
assert s.exist(b(), "ABCCED") is True
assert s.exist(b(), "SEE") is True
assert s.exist(b(), "ABCB") is False
assert s.exist([["a"]], "a") is True
assert s.exist([list("aa")], "aaa") is False
`,
  sig: { fn: "exist", params: ["char[][]", "string"], ret: "bool" },
  call: (a) => [a.board.map((r) => r.split("")), a.word],
  cases: [[[["a"]], "a"], [[["a", "a"]], "aaa"], [[["A", "B"], ["C", "D"]], "ABDC"], [[["A", "B"], ["C", "D"]], "ABCD"], [[["A", "B", "C", "E"], ["S", "F", "E", "S"], ["A", "D", "E", "E"]], "ABCESEEEFS"]],
  legend: [["a", "当前格子"], ["e", "当前路径（已占住 #）"], ["w", "走不通 / 已占冲突"], ["d", "已试过的起点"], ["c", "找到的路径"]],
  presets: [
    { label: "示例 1", args: { board: ["ABCE", "SFCS", "ADEE"], word: "ABCCED" }, note: "word = \"ABCCED\"", expect: true },
    { label: "示例 3", args: { board: ["ABCE", "SFCS", "ADEE"], word: "ABCB" }, note: "word = \"ABCB\"", expect: false },
  ],
  build(a, snap) {
    const B = a.board.map((r) => r.split("")), word = a.word, m = B.length, n = B[0].length;
    const grid = B.map((r) => r.slice()), path = [], tried = new Set();
    const pathStr = () => (path.length ? path.map(([i, j]) => B[i][j]).join("→") : "空");
    const view = (opts = {}) => {
      const cur = opts.cur || null, done = !!opts.done, prevMap = opts.prevMap || {};
      const conflictSet = new Set((opts.conflict || []).map(([x, y]) => `${x},${y}`));
      return [
        {
          t: "grid",
          label: "board（进入格子标 '#' 占住，回溯时还原）",
          rows: grid.map((r, i) => r.map((v, j) => {
            const key = `${i},${j}`, on = path.some(([x, y]) => x === i && y === j);
            const isCur = cur && cur[0] === i && cur[1] === j;
            return {
              v,
              ...(prevMap[key] !== undefined ? { prev: prevMap[key] } : {}),
              cls: done && on ? "c" : isCur ? (opts.curCls || "a") : conflictSet.has(key) ? "w" : on ? "e" : tried.has(key) ? "d" : "",
            };
          })),
        },
        {
          t: "array",
          label: "word",
          items: word.split("").map((ch, k) => ({
            v: ch,
            cls: done ? "c" : k < path.length ? "e" : k === path.length && opts.matchIdx === k ? "a" : "",
          })),
          ptrs: { k: !done && path.length < word.length ? path.length : null },
        },
        {
          t: "chips",
          label: "path（当前路径）",
          items: path.map(([i, j], idx) => ({
            v: `${B[i][j]}(${i},${j})`,
            cls: done ? "c" : idx === path.length - 1 ? "a" : "e",
          })),
          empty: "空",
        },
      ];
    };
    snap("开始", `在网格里找单词 <b>${word}</b>。每个格子都当一次起点，相邻是指上下左右。`, view(), {
      at: "init",
      facts: [["path", "空"], ["已找到", "否"], ["剩余", word]],
    });
    const dfs = (i, j, k) => {
      const prevPath = pathStr(), prevRem = word.slice(k);
      path.push([i, j]);
      if (k === word.length - 1) return true;
      const curPath = pathStr(), curRem = word.slice(k + 1);
      grid[i][j] = "#";
      snap("做选择（占住格子）", `(${i},${j}) 是 '${B[i][j]}'，匹配 word[${k}]。把它标成 '#' 占住，去相邻格子找 <b>'${word[k + 1]}'</b>。`, view({
        cur: [i, j],
        prevMap: { [`${i},${j}`]: B[i][j] },
      }), {
        at: "match",
        facts: [["path", curPath, prevPath], ["已找到", "否"], ["剩余", curRem, prevRem]],
      });
      const conflicts = [];
      for (const [x, y] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (x < 0 || y < 0 || x >= m || y >= n) continue;
        if (grid[x][y] === "#") {
          if (B[x][y] === word[k + 1]) conflicts.push([x, y]);
          continue;
        }
        if (B[x][y] !== word[k + 1]) continue;
        if (dfs(x, y, k + 1)) return true;
      }
      const beforeBackPath = pathStr(), beforeBackRem = word.slice(k + 1);
      path.pop();
      grid[i][j] = B[i][j];
      if (k === 0) tried.add(`${i},${j}`);
      const why = conflicts.length
        ? `相邻的 '${word[k + 1]}' 已被标为 '#' 占住，不能回头`
        : `周围没有能接上的 '${word[k + 1]}'`;
      snap("撤销选择（回溯）", `(${i},${j}) 走不通（${why}）。把 '#' 还原回 '${B[i][j]}'，退回上一步。`, view({
        cur: [i, j],
        curCls: "w",
        conflict: conflicts,
        prevMap: { [`${i},${j}`]: "#" },
      }), {
        at: "back",
        kind: "warn",
        facts: [["path", pathStr(), beforeBackPath], ["已找到", "否"], ["剩余", word.slice(k), beforeBackRem]],
      });
      return false;
    };
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
      if (B[i][j] !== word[0]) continue;
      snap("尝试起点", `(${i},${j}) 是 '${word[0]}'，从这里出发试试。`, view({ cur: [i, j], matchIdx: 0 }), {
        at: "start",
        facts: [["path", "空"], ["已找到", "否"], ["剩余", word]],
      });
      if (dfs(i, j, 0)) {
        const prevMap = {};
        for (const [x, y] of path) {
          if (grid[x][y] === "#") { prevMap[`${x},${y}`] = "#"; grid[x][y] = B[x][y]; }
        }
        const fullPath = pathStr();
        const prevPath = path.length > 1 ? path.slice(0, -1).map(([x, y]) => B[x][y]).join("→") : "空";
        snap("找到路径", `最后一个字母 '${word[word.length - 1]}' 也对上了，路径是 ${path.map(([x, y]) => `(${x},${y})`).join(" → ")}。还原棋盘并返回 <b>true</b>。`, view({ done: true, prevMap }), {
          at: ["found", "yes"],
          kind: "ok",
          ans: true,
          facts: [["path", fullPath, prevPath], ["已找到", "是", "否"], ["剩余", "无", word[word.length - 1]]],
        });
        return;
      }
    }
    snap("找不到", `所有起点都试过了，拼不出 ${word}，返回 <b>false</b>。`, view(), {
      at: "no",
      kind: "warn",
      ans: false,
      facts: [["path", "空"], ["已找到", "否"], ["剩余", word]],
    });
  },
  points: [
    { t: "还原要在所有出口", body: "找到答案提前 return 时也要先把格子改回来，否则会把输入的网格弄坏。" },
    { t: "先比字母再标记", body: "不匹配直接返回，不要先改成 '#' 再判断。" },
    { t: "复杂度", body: "每个起点最多往 3 个方向分叉（不能回头），时间 O(m·n·3ᴸ)，L 是单词长度。" },
  ],
};
