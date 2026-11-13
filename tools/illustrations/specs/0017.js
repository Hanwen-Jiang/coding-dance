module.exports = {
  id: 17, name: "电话号码的字母组合", title: "电话号码的字母组合图解", level: "中等", topic: "回溯",
  h1: "电话号码的字母组合，一位一位地选",
  lede: "每个数字对应几个字母，要列出所有的选法。做法是一位一位往下选：第一位选一个字母，接着选第二位，选满了就记下来。然后退回一步，把刚才那一位换成下一个字母，再继续。这种「选一个、往下走、退回来换一个」的过程就是回溯。",
  hints: [
    { t: "把它想成一棵树", body: ["第一层是第一个数字的几个字母，每个字母下面再分出第二个数字的几个字母。", "从根走到叶子的每一条路，就是一个组合。"] },
    { t: "递归函数管什么", body: ["<code>dfs(i)</code>：现在该为第 <code>i</code> 个数字选字母了。", "<code>i</code> 等于数字的个数时，说明每一位都选好了，把当前路径记进结果。"] },
    { t: "回溯的三步", body: ["选：把一个字母放进路径。", "往下：<code>dfs(i + 1)</code>。", "撤销：把这个字母从路径里拿出来，换下一个字母再试。"] },
  ],
  codes: [{ t: "标准解法：回溯", code: `
class Solution:
    def letterCombinations(self, digits: str) -> List[str]:
        if not digits:
            return []
        phone = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl",
                 "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}
        res, path = [], []
        def dfs(i):
            if i == len(digits):
                res.append("".join(path))
                return
            for ch in phone[digits[i]]:
                path.append(ch)         # 选
                dfs(i + 1)              # 往下
                path.pop()              # 撤销
        dfs(0)
        return res
` }],
  pytest: `
s = Solution()
assert s.letterCombinations("23") == ["ad","ae","af","bd","be","bf","cd","ce","cf"]
assert s.letterCombinations("") == []
assert s.letterCombinations("2") == ["a","b","c"]
assert len(s.letterCombinations("79")) == 16
`,
  legend: [["a", "正在选的这一位"], ["e", "当前路径"], ["k", "刚记下的组合"]],
  presets: [
    { label: "示例 1", args: { d: "23" }, note: 'digits = "23"', expect: ["ad", "ae", "af", "bd", "be", "bf", "cd", "ce", "cf"] },
    { label: "三位数字", args: { d: "234" }, note: 'digits = "234"（只演示前 6 个组合的过程，结果是完整的）', expect: 27 },
  ],
  build(a, snap) {
    const d = a.d, phone = { 2: "abc", 3: "def", 4: "ghi", 5: "jkl", 6: "mno", 7: "pqrs", 8: "tuv", 9: "wxyz" }, res = [], path = [];
    const quiet = d.length > 2; let shown = true;
    const view = (i, fresh) => [
      { t: "array", label: "digits", items: [...d].map((v, t) => ({ v, cls: t === i ? "a" : "" })), idx: false, ptrs: { i: i >= 0 && i < d.length ? i : null } },
      { t: "chips", label: i >= 0 && i < d.length ? `数字 ${d[i]} 对应的字母` : "对应的字母", items: i >= 0 && i < d.length ? [...phone[d[i]]].map((c) => ({ v: c, cls: path[i] === c ? "a" : "" })) : [], empty: "所有位都选完了" },
      { t: "chips", label: "当前路径 path", items: path.map((c) => ({ v: c, cls: "e" })), empty: "空" },
      { t: "chips", label: `结果（${res.length} 个）`, items: res.map((r, t) => ({ v: r, cls: fresh && t === res.length - 1 ? "k" : "" })), empty: "还没有" },
    ];
    const S = (...x) => { if (shown) snap(...x); };
    snap("开始", `一共 ${d.length} 位数字，从第 0 位开始选。`, view(0));
    const dfs = (i) => {
      if (i === d.length) { res.push(path.join("")); S("记下一个组合", `每一位都选好了，把 <b>"${path.join("")}"</b> 记进结果。然后退回上一位。`, view(i, true), { kind: "ok" }); if (quiet && res.length === 6) shown = false; return; }
      for (const ch of phone[d[i]]) {
        path.push(ch);
        S("选", `第 ${i} 位是数字 ${d[i]}，选字母 <b>${ch}</b>，放进路径。` + (i + 1 < d.length ? `接着去选第 ${i + 1} 位。` : ""), view(i));
        dfs(i + 1);
        path.pop();
        S("撤销", `把 ${ch} 从路径里拿出来。` + (ch === phone[d[i]].slice(-1) ? `数字 ${d[i]} 的字母都试过了，再往上退一位。` : "换这一位的下一个字母。"), view(i), { kind: "warn" });
      }
    };
    dfs(0);
    snap("完成", `所有选法都走完了，一共 <b>${res.length}</b> 个组合` + (quiet ? "（后面的过程和前面一样，没有逐步演示）。" : "。"), view(-1), { kind: "ok", ans: quiet ? res.length : res });
  },
  points: [
    { t: "空字符串", body: "<code>digits</code> 为空时要返回 <code>[]</code>。不特判的话会得到 <code>[\"\"]</code>。" },
    { t: "撤销不能少", body: "<code>path.pop()</code> 把这一位清掉，下一个字母才能放在同一个位置上。" },
    { t: "复杂度", body: "每位有 3 或 4 种选择，组合数最多 4ⁿ 个，每个组合长 n，时间 O(n · 4ⁿ)。" },
  ],
};
