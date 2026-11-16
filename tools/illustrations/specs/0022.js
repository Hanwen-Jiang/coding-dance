module.exports = {
  id: 22, name: "括号生成", title: "括号生成图解", level: "中等", topic: "回溯",
  h1: "括号生成，边放边检查",
  lede: "一个字符一个字符地放。只要保证任何时候右括号都不比左括号多、左括号不超过 n 个，放满 2n 个时得到的就一定合法，不用最后再检查。",
  hints: [
    { t: "什么样的前缀还有救", body: ["从左往右读一个合法的括号串，任何时刻读到的 <code>)</code> 都不会比 <code>(</code> 多。", "左括号总数也不能超过 <code>n</code>。满足这两条的前缀，一定能补成合法的串。"] },
    { t: "每一步只有两种选择", body: ["已经放了 <code>open</code> 个左括号、<code>close</code> 个右括号。", "<code>open &lt; n</code> 时可以放 <code>(</code>；<code>close &lt; open</code> 时可以放 <code>)</code>。两种都试一遍，就是回溯。"] },
    { t: "什么时候收集答案", body: ["长度到了 <code>2n</code> 就收集。因为每一步都守住了规则，这时的串一定合法。", "先试 <code>(</code> 再试 <code>)</code>，得到的结果正好是字典序。"] },
  ],
  codes: [{ t: "标准解法：回溯", code: `
class Solution:
    def generateParenthesis(self, n: int) -> List[str]:
        res, path = [], []              #@init

        def dfs(open_, close):
            if len(path) == 2 * n:          #@collect
                res.append("".join(path))   #@collect
                return                      #@collect
            if open_ < n:                   # 还能放左括号 #@open
                path.append("(")            #@open
                dfs(open_ + 1, close)       #@open
                path.pop()
            if close < open_:               # 右括号不能比左括号多 #@close
                path.append(")")            #@close
                dfs(open_, close + 1)       #@close
                path.pop()

        dfs(0, 0)                           #@init
        return res                          #@done
` }, { t: "简洁写法：生成器", kind: "elegant", note: "l、r 记还剩几个左括号、右括号没放。剩下的右括号比左括号多，才能放右括号。", code: `
class Solution:
    def generateParenthesis(self, n: int) -> List[str]:
        def gen(s, l, r):
            if not r:
                yield s
            if l:
                yield from gen(s + "(", l - 1, r)
            if r > l:
                yield from gen(s + ")", l, r - 1)
        return list(gen("", n, n))
` }],
  sig: { fn: "generateParenthesis", params: ["int"], ret: "List<string>", cmp: "unordered" },
  call: (a) => [a.n],
  cases: [[1], [4]],
  pytest: `
s = Solution()
assert s.generateParenthesis(3) == ["((()))","(()())","(())()","()(())","()()()"]
assert s.generateParenthesis(1) == ["()"]
assert len(s.generateParenthesis(4)) == 14
assert len(set(s.generateParenthesis(5))) == 42
`,
  legend: [["a", "刚放下的括号"], ["c", "收集到的组合"]],
  presets: [
    { label: "n = 2", args: { n: 2 }, note: "n = 2", expect: ["(())", "()()"] },
    { label: "n = 3", args: { n: 3 }, note: "n = 3", expect: ["((()))", "(()())", "(())()", "()(())", "()()()"] },
  ],
  build(a, snap) {
    const n = a.n, res = [], path = [];
    const view = (hl) => [
      path.length ? { t: "array", label: "当前路径", items: path.map((c, i) => ({ v: c, cls: i === path.length - 1 ? hl : "" })) } : { t: "note", label: "当前路径", html: "空" },
      { t: "chips", label: "已收集的组合", items: res.map((s, i) => ({ v: s, cls: hl === "c" && i === res.length - 1 ? "c" : "" })), empty: "还没有" },
    ];
    const facts = (o, c) => ({ facts: [["左括号", `${o} / ${n}`], ["右括号", `${c} / ${n}`]] });
    snap("开始", `要放 ${n} 对括号，一共 ${2 * n} 个字符。左括号不能超过 ${n} 个，右括号不能比左括号多。`, view(""), { at: "init", ...facts(0, 0) });
    const dfs = (o, c) => {
      if (path.length === 2 * n) {
        res.push(path.join(""));
        snap("收集", `放满 ${2 * n} 个了，得到 <b>${res[res.length - 1]}</b>。回到上一层，试另一种选择。`, view("c"), { at: "collect", ...facts(o, c) });
        return;
      }
      if (o < n) { path.push("("); snap("放 (", `左括号才用了 ${o} 个，还没到 ${n}，放一个 <b>(</b>。`, view("a"), { at: "open", ...facts(o + 1, c) }); dfs(o + 1, c); path.pop(); }
      if (c < o) { path.push(")"); snap("放 )", `右括号 ${c} 个，比左括号 ${o} 个少，可以放一个 <b>)</b>。`, view("a"), { at: "close", ...facts(o, c + 1) }); dfs(o, c + 1); path.pop(); }
    };
    dfs(0, 0);
    snap("完成", `所有分支都试完了，一共 <b>${res.length}</b> 种合法组合。`, view(""), { at: "done", kind: "ok", ans: res.slice(), facts: [["组合数", res.length]] });
  },
  points: [
    { t: "两个条件守住合法性", body: "<code>open &lt; n</code> 才放左括号，<code>close &lt; open</code> 才放右括号。收集时不用再检查。" },
    { t: "撤销选择", body: "用列表 <code>path</code> 回溯时，递归返回后要 <code>pop()</code>。用字符串拼接传参就不用撤销。" },
    { t: "复杂度", body: "结果个数是卡特兰数，约 4ⁿ / (n√n)，每个结果长度 2n。" },
  ],
};
