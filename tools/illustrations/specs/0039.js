module.exports = {
  id: 39, name: "组合总和", title: "组合总和图解", level: "中等", topic: "回溯",
  h1: "组合总和，只往后选就不会重复",
  lede: "每个数可以用很多次，但 [2,2,3] 和 [2,3,2] 算同一个组合。规定每次只能从当前位置往后选，组合里的数就是按下标不减的顺序出现的，自然不会重复。",
  hints: [
    { t: "怎么避免重复的组合", body: ["如果每一步都能从所有数里挑，就会同时得到 <code>[2,3,2]</code> 和 <code>[2,2,3]</code>。", "规定：选了下标 <code>i</code> 的数之后，下一个数只能从下标 <code>i</code> 及之后挑。每个组合只会以一种顺序被生成。"] },
    { t: "递归需要哪些参数", body: ["<code>start</code>：这一层从哪个下标开始挑；<code>remain</code>：还差多少。", "<code>remain == 0</code> 就收集一份 <code>path</code>。选了 <code>candidates[i]</code> 后递归 <code>dfs(i, remain - candidates[i])</code>，还从 <code>i</code> 开始，因为可以重复选。"] },
    { t: "排序后可以提前停", body: ["先把 <code>candidates</code> 排序。某个数已经比 <code>remain</code> 大了，后面的数只会更大，直接 <code>break</code>。"] },
  ],
  codes: [{ t: "标准解法：回溯 + 排序剪枝", code: `
class Solution:
    def combinationSum(self, candidates: List[int], target: int) -> List[List[int]]:
        candidates.sort()               #@init
        res, path = [], []              #@init

        def dfs(start, remain):
            if remain == 0:             #@found
                res.append(path[:])     #@found
                return                  #@found
            for i in range(start, len(candidates)):
                if candidates[i] > remain:      # 排过序，后面的只会更大 #@prune
                    break                       #@prune
                path.append(candidates[i])      #@pick
                dfs(i, remain - candidates[i])  # 还从 i 开始：可以重复选 #@pick
                path.pop()

        dfs(0, target)                  #@init
        return res                      #@done
` }, { t: "简洁写法：选或不选，直接返回组合", key: "pick", kind: "elegant", note: "对第 i 个数只有两种决定：再选一次它，或者以后都不选它了。两种情况的结果拼起来就是答案。", code: `
class Solution:
    def combinationSum(self, candidates: List[int], target: int) -> List[List[int]]:
        def dfs(i, remain):
            if remain == 0:             #@found
                return [[]]             #@found
            if i == len(candidates) or remain < 0:  #@empty
                return []               #@empty
            c = candidates[i]           #@take
            return [[c] + rest for rest in dfs(i, remain - c)] + dfs(i + 1, remain)    #@take,skip
        return dfs(0, target)           #@start
` }],
  pytest: `
s = Solution()
norm = lambda r: sorted(sorted(x) for x in r)
assert norm(s.combinationSum([2,3,6,7], 7)) == [[2,2,3],[7]]
assert norm(s.combinationSum([2,3,5], 8)) == [[2,2,2,2],[2,3,3],[3,5]]
assert s.combinationSum([2], 1) == []
assert norm(s.combinationSum([7,3,2], 18)) == norm(s.combinationSum([2,3,7], 18))
`,
  sig: { fn: "combinationSum", params: ["int[]", "int"], ret: "List<List<int>>", cmp: "unordered" },
  call: (a) => [a.c, a.target],
  cases: [[[2], 1], [[1], 1], [[7, 3, 2], 18], [[8, 7, 4, 3], 11]],
  method: "回溯 + 剪枝",
  cmp: "unordered",
  legend: [["a", "这一步选的数"], ["e", "这一层可以选的范围"], ["w", "太大，剪掉"], ["c", "凑够了"]],
  presets: [
    { label: "示例 1", args: { c: [2, 3, 6, 7], target: 7 }, note: "candidates = [2,3,6,7], target = 7", expect: [[2, 2, 3], [7]] },
    { label: "示例 2", args: { c: [2, 3, 5], target: 8 }, note: "candidates = [2,3,5], target = 8", expect: [[2, 2, 2, 2], [2, 3, 3], [3, 5]] },
  ],
  build(a, snap) {
    const c = a.c.slice().sort((x, y) => x - y), target = a.target, res = [], path = [];
    const view = (start, i, cls) => [
      { t: "array", label: "candidates（排好序）", items: c.map((v, k) => ({ v, cls: k === i ? cls : k >= start && start >= 0 ? "e" : "" })), ptrs: { start: start >= 0 ? start : null, i: i >= 0 ? i : null } },
      { t: "chips", label: "path", items: path.slice(), empty: "空" },
      { t: "chips", label: "已收集的组合", items: res.map((r) => `[${r.join(",")}]`), empty: "还没有" },
    ];
    snap("开始", `从 [${c.join(",")}] 里选数凑出 ${target}，每个数可以选多次。`, view(-1, -1), { at: "init", facts: [["还差", target]] });
    const dfs = (start, remain) => {
      if (remain === 0) { res.push(path.slice()); snap("凑够了", `path = [${path.join(",")}]，和正好是 ${target}，收集。`, view(-1, -1), { at: "found", kind: "ok", facts: [["还差", 0]] }); return; }
      for (let i = start; i < c.length; i++) {
        if (c[i] > remain) { snap("剪枝", `还差 ${remain}，但 ${c[i]} 已经比它大了。后面的数只会更大，这一层到此为止。`, view(start, i, "w"), { at: "prune", kind: "warn", facts: [["还差", remain]] }); break; }
        path.push(c[i]);
        snap("选", `选 ${c[i]}，还差 ${remain} − ${c[i]} = <b>${remain - c[i]}</b>。下一层还从下标 ${i} 开始，${c[i]} 还能再选。`, view(start, i, "a"), { at: "pick", facts: [["还差", remain - c[i]]] });
        dfs(i, remain - c[i]);
        path.pop();
      }
    };
    dfs(0, target);
    snap("完成", `一共找到 ${res.length} 个组合：${res.map((r) => `[${r.join(",")}]`).join("、")}。`, view(-1, -1), { at: "done", kind: "ok", ans: res.map((r) => r.slice()), facts: [["组合数", res.length]] });
  },
  alts: [{
    t: "选或不选",
    code: "pick",
    note: "和简洁写法一样：对第 i 个数只有两种决定：再选一次它（i 不动），或者以后都不选它（i + 1）。两条分支返回的组合拼起来就是答案。",
    legend: [["a", "选它"], ["b", "不选它了"], ["w", "超过 target"], ["d", "已经决定不选的数"]],
    build(a, snap) {
      const c = a.c, target = a.target, path = [], found = [];
      const view = (i, cls) => [
        { t: "array", label: "candidates", items: c.map((v, k) => ({ v, cls: k === i ? cls : k < i ? "d" : "" })), ptrs: { i: i >= 0 && i < c.length ? i : null } },
        { t: "chips", label: "这条分支上选了的数", items: path.slice(), empty: "空" },
        { t: "chips", label: "找到的组合", items: found.map((r) => `[${r.join(",")}]`), empty: "还没有" },
      ];
      const f = (r) => ({ facts: [["还差", r]] });
      const dfs = (i, remain) => {
        if (remain === 0) {
          found.push(path.slice());
          snap("凑够了", `还差 0：这条分支选的 [${path.join(",")}] 正好凑出 ${target}。返回 [[]]，回去的路上每一层把自己选的数加在前面。`, view(-1, ""), { at: "found", kind: "ok", ...f(0) });
          return [[]];
        }
        if (remain < 0) { snap("超了", `还差 ${remain}，已经超过 target 了，这条分支返回空。`, view(i, "w"), { at: "empty", kind: "warn", ...f(remain) }); return []; }
        if (i === c.length) { snap("没得选了", `所有数都决定过了，还差 ${remain}，这条分支返回空。`, view(i, ""), { at: "empty", kind: "warn", ...f(remain) }); return []; }
        const x = c[i];
        path.push(x);
        snap("选", `考虑 ${x}，还差 ${remain}。先走「再选一次 ${x}」：还差 ${remain - x}，下一层还停在 ${x}。`, view(i, "a"), { at: "take", ...f(remain - x) });
        const A = dfs(i, remain - x).map((r) => [x, ...r]);
        path.pop();
        snap("不选", `「选 ${x}」这条分支走完了。再走「以后都不选 ${x}」：还差 ${remain}，看下一个数。`, view(i, "b"), { at: "skip", ...f(remain) });
        return A.concat(dfs(i + 1, remain));
      };
      snap("开始", `从 [${c.join(",")}] 里选数凑出 ${target}。每一层只对一个数做决定。`, view(-1, ""), { at: "start", ...f(target) });
      const res = dfs(0, target);
      snap("完成", `两种决定都试完了，一共 ${res.length} 个组合${res.length ? "：" + res.map((r) => `[${r.join(",")}]`).join("、") : ""}。`, view(-1, ""), { at: "start", kind: "ok", ans: res, facts: [["组合数", res.length]] });
    },
  }],
  points: [
    { t: "递归传 i 而不是 i + 1", body: "传 i 表示当前数还能再选；如果每个数只能用一次（第 40 题），就传 i + 1。" },
    { t: "收集时要拷贝", body: "<code>res.append(path[:])</code>。直接放 path 的话，回溯会把它改掉。" },
    { t: "复杂度", body: "和答案个数相关，最坏是指数级。剪枝能砍掉大量没希望的分支。" },
  ],
};
