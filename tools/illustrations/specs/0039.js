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
  legend: [["a", "这一步选的数"], ["e", "本层可选范围"], ["d", "已试过 / 跳过"], ["w", "太大剪枝 / 回溯"], ["c", "凑够收集"]],
  presets: [
    { label: "示例 1", args: { c: [2, 3, 6, 7], target: 7 }, note: "candidates = [2,3,6,7], target = 7", expect: [[2, 2, 3], [7]] },
    { label: "示例 2", args: { c: [2, 3, 5], target: 8 }, note: "candidates = [2,3,5], target = 8", expect: [[2, 2, 2, 2], [2, 3, 3], [3, 5]] },
  ],
  build(a, snap) {
    const c = a.c.slice().sort((x, y) => x - y), target = a.target, res = [], path = [];
    const pStr = () => (path.length ? `[${path.join(",")}]` : "空");
    let prevP = pStr(), prevF = 0, prevR = target;
    const emit = (phase, msg, views, remain, o = {}) => {
      const curP = pStr(), curF = res.length;
      const facts = o.facts || [
        ["path", curP, prevP],
        ["已找到", curF, prevF],
        ["剩余", remain, prevR],
      ];
      prevP = curP; prevF = curF; prevR = remain;
      snap(phase, msg, views, { ...o, facts });
    };
    const view = (start, i, cls, opts = {}) => [
      {
        t: "array",
        label: "candidates（排好序）",
        items: c.map((v, k) => ({
          v,
          cls: opts.pruneFrom !== undefined && k >= opts.pruneFrom ? "w"
            : k === i ? cls
            : start >= 0 && k < i ? "d"
            : start >= 0 && k > i ? "e"
            : "",
        })),
        ptrs: { start: start >= 0 ? start : null, i: i >= 0 ? i : null },
      },
      {
        t: "chips",
        label: "path",
        items: path.map((v, k) => ({
          v,
          cls: opts.fresh ? "c" : opts.picked && k === path.length - 1 ? "a" : "e",
        })),
        empty: "空",
      },
      {
        t: "chips",
        label: "已收集的组合",
        items: res.map((r, k) => ({
          v: `[${r.join(",")}]`,
          cls: opts.fresh && k === res.length - 1 ? "c" : "",
        })),
        empty: "还没有",
      },
    ];
    emit("开始", `从 [${c.join(",")}] 里选数凑出 ${target}，每个数可以选多次。`, view(-1, -1, ""), target, { at: "init", facts: [["path", "空"], ["已找到", 0], ["剩余", target]] });
    const dfs = (start, remain) => {
      if (remain === 0) {
        res.push(path.slice());
        emit("凑够了", `path = [${path.join(",")}]，和正好是 ${target}，收集进结果后回溯。`, view(-1, -1, "", { fresh: true }), 0, { at: "found", kind: "ok" });
        return;
      }
      for (let i = start; i < c.length; i++) {
        if (c[i] > remain) {
          emit("剪枝", `还差 ${remain}，但 ${c[i]} 已经比它大了。排过序后面的只会更大，这一层直接剪枝返回。`, view(start, i, "w", { pruneFrom: i }), remain, { at: "prune", kind: "warn" });
          break;
        }
        path.push(c[i]);
        emit("选", `选 ${c[i]}，还差 ${remain} − ${c[i]} = <b>${remain - c[i]}</b>。下一层还从下标 ${i} 开始，${c[i]} 还能再选。`, view(start, i, "a", { picked: true }), remain - c[i], { at: "pick" });
        dfs(i, remain - c[i]);
        path.pop();
        emit("撤销", `把 ${c[i]} 从 path 拿出来，剩余恢复到 <b>${remain}</b>${i + 1 < c.length ? `，准备尝试下一个数 ${c[i + 1]}` : "，这一层尝试结束"}。`, view(start, i, "w"), remain, { at: "pick", kind: "warn" });
      }
    };
    dfs(0, target);
    snap("完成", `一共找到 ${res.length} 个组合${res.length ? "：" + res.map((r) => `[${r.join(",")}]`).join("、") : ""}。`, view(-1, -1, ""), { at: "done", kind: "ok", ans: res.map((r) => r.slice()), facts: [["path", "空"], ["已找到", res.length], ["剩余", target]] });
  },
  alts: [{
    t: "选或不选",
    code: "pick",
    note: "和简洁写法一样：对第 i 个数只有两种决定：再选一次它（i 不动），或者以后都不选它（i + 1）。两条分支返回的组合拼起来就是答案。",
    legend: [["a", "选它"], ["b", "不选它了"], ["w", "超过 target / 剪枝"], ["d", "已经决定不选的数"], ["c", "凑够收集"]],
    build(a, snap) {
      const c = a.c, target = a.target, path = [], found = [];
      const pStr = () => (path.length ? `[${path.join(",")}]` : "空");
      let prevP = pStr(), prevF = 0, prevR = target;
      const emit = (phase, msg, views, remain, o = {}) => {
        const curP = pStr(), curF = found.length;
        const facts = o.facts || [
          ["path", curP, prevP],
          ["已找到", curF, prevF],
          ["剩余", remain, prevR],
        ];
        prevP = curP; prevF = curF; prevR = remain;
        snap(phase, msg, views, { ...o, facts });
      };
      const view = (i, cls, opts = {}) => [
        {
          t: "array",
          label: "candidates",
          items: c.map((v, k) => ({
            v,
            cls: k === i ? cls : k < i ? "d" : i >= 0 && i < c.length ? "e" : "",
          })),
          ptrs: { i: i >= 0 && i < c.length ? i : null },
        },
        {
          t: "chips",
          label: "这条分支上选了的数",
          items: path.map((v, k) => ({
            v,
            cls: opts.fresh ? "c" : opts.picked && k === path.length - 1 ? "a" : "e",
          })),
          empty: "空",
        },
        {
          t: "chips",
          label: "找到的组合",
          items: found.map((r, k) => ({
            v: `[${r.join(",")}]`,
            cls: opts.fresh && k === found.length - 1 ? "c" : "",
          })),
          empty: "还没有",
        },
      ];
      const dfs = (i, remain) => {
        if (remain === 0) {
          found.push(path.slice());
          emit("凑够了", `还差 0：这条分支选的 [${path.join(",")}] 正好凑出 ${target}。返回 [[]]，回去的路上每一层把自己选的数加在前面。`, view(-1, "", { fresh: true }), 0, { at: "found", kind: "ok" });
          return [[]];
        }
        if (remain < 0) {
          emit("超了", `还差 ${remain}，已经超过 target 了，这条分支剪枝返回空。`, view(i, "w"), remain, { at: "empty", kind: "warn" });
          return [];
        }
        if (i === c.length) {
          emit("没得选了", `所有数都决定过了，还差 ${remain}，这条分支返回空。`, view(i, "w"), remain, { at: "empty", kind: "warn" });
          return [];
        }
        const x = c[i];
        path.push(x);
        emit("选", `考虑 ${x}，还差 ${remain}。先走「再选一次 ${x}」：还差 ${remain - x}，下一层还停在 ${x}。`, view(i, "a", { picked: true }), remain - x, { at: "take" });
        const A = dfs(i, remain - x).map((r) => [x, ...r]);
        path.pop();
        emit("不选", `「选 ${x}」这条分支走完了，撤销 ${x}。再走「以后都不选 ${x}」：还差 ${remain}，看下一个数。`, view(i, "b"), remain, { at: "skip" });
        return A.concat(dfs(i + 1, remain));
      };
      emit("开始", `从 [${c.join(",")}] 里选数凑出 ${target}。每一层只对一个数做决定。`, view(-1, ""), target, { at: "start", facts: [["path", "空"], ["已找到", 0], ["剩余", target]] });
      const res = dfs(0, target);
      snap("完成", `两种决定都试完了，一共 ${res.length} 个组合${res.length ? "：" + res.map((r) => `[${r.join(",")}]`).join("、") : ""}。`, view(-1, ""), { at: "start", kind: "ok", ans: res.map((r) => r.slice()), facts: [["path", "空"], ["已找到", res.length], ["剩余", target]] });
    },
  }],
  points: [
    { t: "递归传 i 而不是 i + 1", body: "传 i 表示当前数还能再选；如果每个数只能用一次（第 40 题），就传 i + 1。" },
    { t: "收集时要拷贝", body: "<code>res.append(path[:])</code>。直接放 path 的话，回溯会把它改掉。" },
    { t: "复杂度", body: "和答案个数相关，最坏是指数级。剪枝能砍掉大量没希望的分支。" },
  ],
};
