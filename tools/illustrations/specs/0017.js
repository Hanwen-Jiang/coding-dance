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
        phone = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl",   #@init
                 "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}     #@init
        res, path = [], []              #@init
        def dfs(i):
            if i == len(digits):        #@record
                res.append("".join(path))   #@record
                return                  #@record
            for ch in phone[digits[i]]: #@pick
                path.append(ch)         # 选 #@pick
                dfs(i + 1)              # 往下 #@pick
                path.pop()              # 撤销 #@undo
        dfs(0)                          #@init
        return res                      #@done
` }, { t: "简洁写法：笛卡尔积", key: "prod", kind: "elegant", note: "每个数字对应一组字母，所有组合就是这几组字母的笛卡尔积。", code: `
from itertools import product

class Solution:
    def letterCombinations(self, digits: str) -> List[str]:
        if not digits:                  #@empty
            return []                   #@empty
        m = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl",   #@init
             "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz"}     #@init
        return ["".join(p) for p in product(*(m[d] for d in digits))]   #@mul,done
` }],
  sig: { fn: "letterCombinations", params: ["string"], ret: "List<string>", cmp: "unordered" },
  call: (a) => [a.d],
  cases: [[""], ["2"], ["79"], ["234"]],
  pytest: `
s = Solution()
assert s.letterCombinations("23") == ["ad","ae","af","bd","be","bf","cd","ce","cf"]
assert s.letterCombinations("") == []
assert s.letterCombinations("2") == ["a","b","c"]
assert len(s.letterCombinations("79")) == 16
`,
  method: "回溯",
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
    snap("开始", `一共 ${d.length} 位数字，从第 0 位开始选。`, view(0), { at: "init" });
    const dfs = (i) => {
      if (i === d.length) { res.push(path.join("")); S("记下一个组合", `每一位都选好了，把 <b>"${path.join("")}"</b> 记进结果。然后退回上一位。`, view(i, true), { at: "record", kind: "ok" }); if (quiet && res.length === 6) shown = false; return; }
      for (const ch of phone[d[i]]) {
        path.push(ch);
        S("选", `第 ${i} 位是数字 ${d[i]}，选字母 <b>${ch}</b>，放进路径。` + (i + 1 < d.length ? `接着去选第 ${i + 1} 位。` : ""), view(i), { at: "pick" });
        dfs(i + 1);
        path.pop();
        S("撤销", `把 ${ch} 从路径里拿出来。` + (ch === phone[d[i]].slice(-1) ? `数字 ${d[i]} 的字母都试过了，再往上退一位。` : "换这一位的下一个字母。"), view(i), { at: "undo", kind: "warn" });
      }
    };
    dfs(0);
    snap("完成", `所有选法都走完了，一共 <b>${res.length}</b> 个组合` + (quiet ? "（后面的过程和前面一样，没有逐步演示）。" : "。"), view(-1), { at: "done", kind: "ok", ans: quiet ? res.length : res });
  },
  alts: [{
    t: "笛卡尔积",
    code: "prod",
    note: "和简洁写法一样：所有组合就是几组字母的笛卡尔积。一位一位地乘上去：已有的每个前缀，后面分别接上这一位的每个字母。",
    legend: [["a", "正在乘上的这一位"], ["k", "这一轮得到的组合"]],
    build(a, snap) {
      const d = a.d, phone = { 2: "abc", 3: "def", 4: "ghi", 5: "jkl", 6: "mno", 7: "pqrs", 8: "tuv", 9: "wxyz" };
      let combos = [""];
      const view = (i) => [
        { t: "array", label: "digits", items: [...d].map((v, t) => ({ v, cls: t === i ? "a" : t < i ? "d" : "" })), idx: false },
        { t: "chips", label: i >= 0 && i < d.length ? `数字 ${d[i]} 对应的字母` : "对应的字母", items: i >= 0 && i < d.length ? [...phone[d[i]]] : [], empty: "—" },
        { t: "chips", label: `组合（${combos.length} 个）`, items: combos.map((c) => ({ v: c === "" ? "空串" : c, cls: i >= 0 ? "k" : "" })) },
      ];
      if (!d.length) { snap("完成", "digits 是空的，返回 []。", view(-1), { at: "empty", kind: "ok", ans: [] }); return; }
      snap("开始", "一开始只有一个空前缀。", view(-1), { at: "init" });
      for (let i = 0; i < d.length; i++) {
        const L = phone[d[i]], old = combos.length;
        combos = combos.flatMap((c) => [...L].map((ch) => c + ch));
        snap(`乘上第 ${i} 位`, `第 ${i} 位是 ${d[i]}，对应 ${L.length} 个字母。已有的 ${old} 个前缀后面各接一个字母，变成 ${old} × ${L.length} = <b>${combos.length}</b> 个。`, view(i), { at: "mul" });
      }
      snap("完成", `一共 <b>${combos.length}</b> 个组合，顺序和回溯的结果一样。`, view(-1), { at: "done", kind: "ok", ans: d.length > 2 ? combos.length : combos });
    },
  }],
  points: [
    { t: "空字符串", body: "<code>digits</code> 为空时要返回 <code>[]</code>。不特判的话会得到 <code>[\"\"]</code>。" },
    { t: "撤销不能少", body: "<code>path.pop()</code> 把这一位清掉，下一个字母才能放在同一个位置上。" },
    { t: "复杂度", body: "每位有 3 或 4 种选择，组合数最多 4ⁿ 个，每个组合长 n，时间 O(n · 4ⁿ)。" },
  ],
};
