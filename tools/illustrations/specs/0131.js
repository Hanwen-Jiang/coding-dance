module.exports = {
  id: 131, name: "分割回文串", title: "分割回文串图解", level: "中等", topic: "回溯",
  h1: "分割回文串，一刀一刀往后切",
  lede: "先决定第一段切多长：只有第一段是回文，才值得继续切剩下的部分。剩下的部分是同样的问题，递归下去；切到末尾，就得到一种方案。",
  hints: [
    { t: "先切第一刀", body: ["第一段可以是 <code>s[0:1]</code>、<code>s[0:2]</code>……一直到整个串。", "第一段不是回文的，直接跳过。"] },
    { t: "剩下的部分是子问题", body: ["第一段 <code>s[start:end]</code> 是回文时，把它放进 path，再从 <code>end</code> 开始切剩下的。", "<code>start</code> 走到末尾，说明整个串都切完了，收集一份 path。"] },
    { t: "判断回文可以预处理", body: ["直接 <code>piece == piece[::-1]</code> 就能过。", "想更快可以先用动态规划算出 <code>isPal[i][j]</code>，每次判断变成 O(1)。"] },
  ],
  codes: [{ t: "标准解法：回溯", code: `
class Solution:
    def partition(self, s: str) -> List[List[str]]:
        res, path = [], []                      #@init

        def dfs(start):
            if start == len(s):                 #@collect
                res.append(path[:])             #@collect
                return                          #@collect
            for end in range(start + 1, len(s) + 1):    #@try
                piece = s[start:end]            #@try
                if piece == piece[::-1]:        # 这一段是回文才切 #@try,cut
                    path.append(piece)          #@cut
                    dfs(end)                    #@cut
                    path.pop()                  #@back

        dfs(0)                                  #@init
        return res                              #@done
` }, { t: "简洁写法：第一段 + 剩下的所有切法", kind: "elegant", note: "s[i - 1::-1] 是 s[:i] 倒过来。第一段是回文时，把它接在剩下部分的每一种切法前面。", code: `
class Solution:
    def partition(self, s: str) -> List[List[str]]:
        if not s:
            return [[]]
        return [[s[:i]] + rest
                for i in range(1, len(s) + 1) if s[:i] == s[i - 1::-1]
                for rest in self.partition(s[i:])]
` }],
  pytest: `
s = Solution()
assert s.partition("aab") == [["a","a","b"],["aa","b"]]
assert s.partition("a") == [["a"]]
assert s.partition("abba") == [["a","b","b","a"],["a","bb","a"],["abba"]]
assert len(s.partition("aaaa")) == 8
`,
  sig: { fn: "partition", params: ["string"], ret: "List<List<string>>", cmp: "unordered" },
  call: (a) => [a.s],
  cases: [["a"], ["ab"], ["aaaa"], ["abcba"], ["efe"]],
  legend: [["k", "已切好的段（颜色交替）"], ["a", "正在切的一段"], ["w", "不是回文（剪枝）"], ["d", "刚撤销回溯"], ["c", "切完收集"]],
  presets: [
    { label: "示例 1", args: { s: "aab" }, note: "s = \"aab\"", expect: [["a", "a", "b"], ["aa", "b"]] },
    { label: "abba", args: { s: "abba" }, note: "s = \"abba\"", expect: [["a", "b", "b", "a"], ["a", "bb", "a"], ["abba"]] },
  ],
  build(a, snap) {
    const s = a.s, res = [], path = [];
    const pathStr = () => (path.length ? path.join(" | ") : "空");
    const remStr = (idx) => (idx < s.length ? s.slice(idx) : "空");
    const view = (start, end, cls, opts = {}) => {
      const own = [], committed = opts.activeNew ? path.slice(0, -1) : path;
      let p = 0;
      committed.forEach((seg, k) => {
        for (let t = 0; t < seg.length; t++) own[p + t] = opts.done ? "c" : k % 2 ? "g" : "k";
        p += seg.length;
      });
      return [
        {
          t: "array",
          label: "s",
          items: s.split("").map((ch, i) => ({
            v: ch,
            cls: own[i] || (i >= start && i < end ? cls : ""),
          })),
          ptrs: { start: start < s.length ? start : null },
        },
        {
          t: "chips",
          label: "path（当前切分）",
          items: path.map((seg, k) => ({
            v: seg,
            cls: opts.done ? "c" : opts.activeNew && k === path.length - 1 ? "a" : k % 2 ? "g" : "k",
          })),
          empty: "空",
        },
        {
          t: "chips",
          label: "已收集的方案",
          items: res.map((r, idx) => ({
            v: r.join(" | "),
            cls: opts.justCollected && idx === res.length - 1 ? "c" : "",
          })),
          empty: "还没有",
        },
      ];
    };
    snap("开始", `把 "${s}" 切成若干段，每段都是回文。先决定第一段切多长。`, view(0, 0, ""), {
      at: "init",
      facts: [["path", "空"], ["已找到", 0], ["剩余", remStr(0)]],
    });
    const dfs = (start) => {
      if (start === s.length) {
        const prevCount = res.length;
        res.push(path.slice());
        snap("收集方案", `切到了末尾，收集一种方案：<b>${path.join(" | ")}</b>。`, view(s.length, s.length, "", { done: true, justCollected: true }), {
          at: "collect",
          kind: "ok",
          facts: [["path", pathStr()], ["已找到", res.length, prevCount], ["剩余", "空"]],
        });
        return;
      }
      for (let end = start + 1; end <= s.length; end++) {
        const piece = s.slice(start, end), rev = piece.split("").reverse().join("");
        if (piece !== rev) {
          snap("剪枝跳过", `"${piece}" 倒过来是 "${rev}"，不是回文，剪枝跳过。`, view(start, end, "w"), {
            at: "try",
            kind: "warn",
            facts: [["path", pathStr()], ["已找到", res.length], ["剩余", remStr(start)]],
          });
          continue;
        }
        const prevPath = pathStr(), prevRem = remStr(start);
        path.push(piece);
        snap("做选择（切一刀）", `"${piece}" 是回文，切下来放进 path，继续从下标 ${end} 切剩下的${end < s.length ? ` "${s.slice(end)}"` : "（已到末尾）"}。`, view(start, end, "a", { activeNew: true }), {
          at: "cut",
          facts: [["path", pathStr(), prevPath], ["已找到", res.length], ["剩余", remStr(end), prevRem]],
        });
        dfs(end);
        const beforePopPath = pathStr(), beforePopRem = remStr(end);
        path.pop();
        snap("撤销选择（回溯）", `从下标 ${end} 返回，把 "${piece}" 从 path 弹出，退回下标 ${start} 尝试更长的切法。`, view(start, end, "d"), {
          at: "back",
          facts: [["path", pathStr(), beforePopPath], ["已找到", res.length], ["剩余", remStr(start), beforePopRem]],
        });
      }
    };
    dfs(0);
    snap("完成", `所有切法都试过了，一共 <b>${res.length}</b> 种方案。`, view(s.length, s.length, ""), {
      at: "done",
      kind: "ok",
      ans: res.map((r) => r.slice()),
      facts: [["path", "空"], ["已找到", res.length], ["剩余", "空"]],
    });
  },
  points: [
    { t: "end 取到 len(s)", body: "切片右端是开的，<code>range(start + 1, len(s) + 1)</code> 才能让最后一段包含最后一个字符。" },
    { t: "单个字符总是回文", body: "所以每层至少有一种切法，一定能走到末尾。" },
    { t: "复杂度", body: "最多 2ⁿ⁻¹ 种切法，每种要 O(n) 判断和拷贝，时间 O(n·2ⁿ)。" },
  ],
};
