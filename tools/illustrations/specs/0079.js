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
  legend: [["e", "当前路径上的格子"], ["a", "正在看的格子"], ["c", "找到的路径"]],
  presets: [
    { label: "示例 1", args: { board: ["ABCE", "SFCS", "ADEE"], word: "ABCCED" }, note: "word = \"ABCCED\"", expect: true },
    { label: "示例 3", args: { board: ["ABCE", "SFCS", "ADEE"], word: "ABCB" }, note: "word = \"ABCB\"", expect: false },
  ],
  build(a, snap) {
    const B = a.board.map((r) => r.split("")), word = a.word, m = B.length, n = B[0].length, path = [];
    const view = (cur, done) => [
      { t: "grid", label: "board", rows: B.map((r, i) => r.map((v, j) => { const on = path.some(([x, y]) => x === i && y === j); return { v, cls: done && on ? "c" : cur && cur[0] === i && cur[1] === j ? "a" : on ? "e" : "" }; })) },
      { t: "array", label: "word", items: word.split("").map((ch, k) => ({ v: ch, cls: k < path.length ? (done ? "c" : "e") : "" })), ptrs: { k: path.length < word.length ? path.length : null } },
    ];
    snap("开始", `在网格里找单词 <b>${word}</b>。每个格子都当一次起点，相邻是指上下左右。`, view(null), { at: "init" });
    const dfs = (i, j, k) => {
      path.push([i, j]);
      if (k === word.length - 1) return true;
      snap("匹配", `(${i},${j}) 是 ${word[k]}，对上了 word[${k}]。占住它，去相邻格子找 <b>${word[k + 1]}</b>。`, view([i, j]), { at: "match", facts: [["已匹配", `${k + 1} / ${word.length}`]] });
      for (const [x, y] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (x < 0 || y < 0 || x >= m || y >= n || path.some(([p, q]) => p === x && q === y) || B[x][y] !== word[k + 1]) continue;
        if (dfs(x, y, k + 1)) return true;
      }
      path.pop();
      snap("回退", `(${i},${j}) 周围没有能接上的 ${word[k + 1]}，这条路走不通。去掉它的标记，退回上一步。`, view(path.length ? path[path.length - 1] : null), { at: "back", kind: "warn", facts: [["已匹配", `${k} / ${word.length}`]] });
      return false;
    };
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) {
      if (B[i][j] !== word[0]) continue;
      snap("起点", `(${i},${j}) 是 ${word[0]}，从这里出发试试。`, view([i, j]), { at: "start" });
      if (dfs(i, j, 0)) { snap("找到", `最后一个字母也对上了，路径是 ${path.map(([x, y]) => `(${x},${y})`).join(" → ")}。返回 <b>true</b>。`, view(null, true), { at: ["found", "yes"], kind: "ok", ans: true, facts: [["已匹配", `${word.length} / ${word.length}`]] }); return; }
    }
    snap("找不到", `所有起点都试过了，拼不出 ${word}，返回 <b>false</b>。`, view(null), { at: "no", kind: "warn", ans: false });
  },
  points: [
    { t: "还原要在所有出口", body: "找到答案提前 return 时也要先把格子改回来，否则会把输入的网格弄坏。" },
    { t: "先比字母再标记", body: "不匹配直接返回，不要先改成 '#' 再判断。" },
    { t: "复杂度", body: "每个起点最多往 3 个方向分叉（不能回头），时间 O(m·n·3ᴸ)，L 是单词长度。" },
  ],
};
