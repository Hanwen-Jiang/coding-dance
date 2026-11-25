module.exports = {
  slug: "backtracking", name: "回溯", kind: "algo", order: 7,
  lede: "回溯就是带撤销的 DFS：用一个 path 记下当前做过的选择，每一步把一个选择放进去、递归下去、再拿出来，换下一个选择。所有可能的选择序列构成一棵树，回溯就是把这棵树走一遍。子集、排列、组合是三个最基本的形状。",
  related: [46, 78, 17, 39, 22, 79, 131, 51],
  sections: [{
    key: "subsets", t: "子集",
    body: [
      "子集里的数不讲顺序，<code>[1, 2]</code> 和 <code>[2, 1]</code> 是同一个。为了不重复，规定<b>只往后选</b>：<code>dfs(i)</code> 表示接下来只能从 <code>nums[i:]</code> 里挑，选了 <code>nums[j]</code> 以后，下一层从 <code>j + 1</code> 开始。",
      "这棵树的<b>每个节点</b>都是一个子集（包括根上的空集），所以一进入 dfs 就把当前的 path 记进答案。n 个数有 2ⁿ 个子集。",
    ],
    points: [
      { t: "记答案时要复制", body: "<code>res.append(path[:])</code>。path 之后还会变，直接放进去的话，最后所有答案都是同一个（空的）列表。" },
      { t: "撤销", body: "递归回来以后 <code>path.pop()</code>，回到做这个选择之前的状态，才能换下一个。" },
    ],
    codes: [{ t: "只往后选", key: "subsets", code: `
class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        res, path = [], []
        def dfs(i: int) -> None:                # 接下来只能从 nums[i:] 里选
            res.append(path[:])                 # 树上每个节点都是一个子集 #@record
            for j in range(i, len(nums)):       #@choose
                path.append(nums[j])            # 选 nums[j] #@choose
                dfs(j + 1)                      # 下一个只能从 j+1 开始选，不会重复 #@choose
                path.pop()                      # 撤销，换下一个 #@undo
        dfs(0)                                  #@start
        return res                              #@done
` }],
    sig: { fn: "subsets", params: ["int[]"], ret: "List<List<int>>", cmp: "unordered" },
    call: (a) => [a.nums],
    cases: [[[0]], [[1, 2, 3]], [[5, 2, 7, 1]]],
    gen: (R) => { const nums = R.distinct(R.int(1, 4), 1, 9); return { args: { nums }, note: `nums = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["a", "刚选的数"], ["e", "path / 可选范围"], ["d", "这一层不能再选（在 i 前面）"], ["w", "撤销放回"], ["c", "记进答案"]],
      presets: [{ label: "示例 1", args: { nums: [1, 2, 3] }, note: "nums = [1,2,3]", expect: [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]] }],
      build(a, snap) {
        const nums = a.nums, res = [], path = [], idx = [];
        let from = 0, hot = -1, undo = -1;
        const pStr = () => (path.length ? `[${path.join(",")}]` : "空");
        let prevP = pStr(), prevS = "—", prevC = 0;
        const emit = (phase, msg, views, curStart, o = {}) => {
          const curP = pStr(), curC = res.length;
          const facts = o.facts || [
            curP !== prevP ? ["path", curP, prevP] : ["path", curP],
            curStart !== prevS ? ["起点 i", curStart, prevS] : ["起点 i", curStart],
            curC !== prevC ? ["已收集", curC, prevC] : ["已收集", curC],
          ];
          prevP = curP; prevS = curStart; prevC = curC;
          snap(phase, msg, views, { ...o, facts });
        };
        const view = (opts = {}) => [
          {
            t: "array",
            label: `nums（这一层从下标 ${from} 开始选）`,
            items: nums.map((v, k) => ({
              v,
              cls: k === undo ? "w" : k === hot ? "a" : idx.includes(k) ? "e" : k < from ? "d" : "",
            })),
            ptrs: {
              i: from < nums.length ? from : null,
              ...(hot >= 0 ? { j: hot } : undo >= 0 ? { j: undo } : {}),
            },
          },
          {
            t: "chips",
            label: "path",
            items: path.map((v, k) => ({ v, cls: opts.fresh ? "c" : hot >= 0 && k === path.length - 1 ? "a" : "e" })),
            empty: "空",
          },
          {
            t: "chips",
            label: `res（${res.length} 个）`,
            items: res.map((p, k) => ({ v: `[${p.join(",")}]`, cls: opts.fresh && k === res.length - 1 ? "c" : "" })),
            empty: "空",
          },
        ];
        emit("开始", "从下标 0 开始，path 是空的。", view(), "—", {
          at: "start",
          facts: [["path", "空"], ["起点 i", "—"], ["已收集", 0]],
        });
        const dfs = (i) => {
          from = i; hot = -1; undo = -1; res.push(path.slice());
          emit("记一个子集", `进入 dfs(${i})：当前 path = [${path.join(", ")}] 就是一个子集，记进答案。`, view({ fresh: true }), i, { at: "record", kind: "ok" });
          for (let j = i; j < nums.length; j++) {
            path.push(nums[j]); idx.push(j); hot = j; undo = -1; from = i;
            emit("选", `选 nums[${j}] = ${nums[j]}，下一层只能从 ${j + 1} 开始选。`, view(), i, { at: "choose" });
            dfs(j + 1);
            path.pop(); idx.pop(); from = i; hot = -1; undo = j;
            emit("撤销", `从 dfs(${j + 1}) 回来，把 ${nums[j]} 拿出来，path = [${path.join(", ")}]，换下一个。`, view(), i, { at: "undo", kind: "warn" });
          }
        };
        dfs(0);
        from = 0; hot = -1; undo = -1;
        snap("完成", `一共 ${res.length} 个子集。`, view(), {
          at: "done",
          kind: "ok",
          ans: res.map((p) => p.slice()),
          facts: [["path", "空"], ["已收集", res.length]],
        });
      },
    },
  }, {
    key: "permute", t: "排列",
    body: [
      "排列讲顺序，每个位置可以放<b>任何一个还没用过</b>的数，所以每一层都从头扫，用 <code>used</code> 数组跳过已经在 path 里的数。",
      "只有放满 n 个数时（叶子）才是一个完整的排列，这时记答案、返回。n 个不同的数有 n! 个排列。",
    ],
    points: [
      { t: "撤销要成对", body: "选的时候 <code>used[j] = True</code> 并 append；撤销时 pop 并且 <code>used[j] = False</code>，两件事都要还原。" },
      { t: "和子集的区别", body: "子集「只往后选」去掉了顺序；排列每层都从 0 开始，靠 used 防止同一个数用两次。" },
    ],
    codes: [{ t: "used 数组", key: "permute", code: `
class Solution:
    def permute(self, nums: List[int]) -> List[List[int]]:
        res, path, used = [], [], [False] * len(nums)
        def dfs() -> None:
            if len(path) == len(nums):          # 放满了：一个排列 #@full
                res.append(path[:])             #@full
                return                          #@full
            for j in range(len(nums)):          # 每个位置可以放任何一个还没用过的数 #@choose
                if used[j]:                     #@choose
                    continue                    #@choose
                used[j] = True                  #@choose
                path.append(nums[j])            #@choose
                dfs()                           #@choose
                path.pop()                      # 撤销 #@undo
                used[j] = False                 #@undo
        dfs()                                   #@start
        return res                              #@done
` }],
    sig: { fn: "permute", params: ["int[]"], ret: "List<List<int>>", cmp: "unordered" },
    call: (a) => [a.nums],
    cases: [[[1]], [[0, 1]], [[1, 2, 3]], [[4, 1, 3, 2]]],
    gen: (R) => { const nums = R.distinct(R.int(1, 4), 1, 9); return { args: { nums }, note: `nums = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["a", "刚选的数"], ["e", "已在 path 里"], ["d", "已用过 / 本位已试"], ["w", "撤销放回"], ["c", "放满收集"]],
      presets: [{ label: "示例 1", args: { nums: [1, 2, 3] }, note: "nums = [1,2,3]", expect: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]] }],
      build(a, snap) {
        const nums = a.nums, n = nums.length, res = [], path = [], used = new Array(n).fill(false);
        const tried = Array.from({ length: n }, () => new Set());
        const pStr = () => (path.length ? `[${path.join(",")}]` : "空");
        let prevP = pStr(), prevF = 0, prevR = n;
        const emit = (phase, msg, views, o = {}) => {
          const curP = pStr(), curF = res.length, curR = n - path.length;
          const facts = o.facts || [
            curP !== prevP ? ["path", curP, prevP] : ["path", curP],
            curF !== prevF ? ["已收集", curF, prevF] : ["已收集", curF],
            curR !== prevR ? ["剩余空位", curR, prevR] : ["剩余空位", curR],
          ];
          prevP = curP; prevF = curF; prevR = curR;
          snap(phase, msg, views, { ...o, facts });
        };
        const view = (opts = {}) => {
          const depth = path.length;
          return [
            {
              t: "array",
              label: "nums（灰色的已用过或本位已试）",
              items: nums.map((v, k) => ({
                v,
                cls: k === opts.undoNum ? "w" : k === opts.cur ? "a" : used[k] || (depth < n && tried[depth].has(k)) ? "d" : "",
              })),
              ptrs: { j: opts.cur >= 0 ? opts.cur : opts.undoNum >= 0 ? opts.undoNum : null },
            },
            {
              t: "array",
              label: "path（正在填的排列）",
              items: Array.from({ length: n }, (_, k) => ({
                v: k < path.length ? path[k] : "",
                ...(opts.undoSlot === k && opts.undoVal !== undefined ? { prev: opts.undoVal } : {}),
                cls: opts.undoSlot === k ? "w" : k < path.length ? (opts.fresh ? "c" : k === path.length - 1 && opts.cur >= 0 ? "a" : "e") : "",
              })),
              idx: true,
              ptrs: { pos: depth < n ? depth : null },
            },
            {
              t: "chips",
              label: `res（${res.length} 个）`,
              items: res.map((p, k) => ({ v: `[${p.join(",")}]`, cls: opts.fresh && k === res.length - 1 ? "c" : "" })),
              empty: "空",
            },
          ];
        };
        emit("开始", "path 是空的，所有数都还没用过。", view(), {
          at: "start",
          facts: [["path", "空"], ["已收集", 0], ["剩余空位", n]],
        });
        const dfs = () => {
          if (path.length === n) {
            res.push(path.slice());
            emit("放满了", `path = [${path.join(", ")}] 放满了 ${n} 个数，是一个排列，记进答案，返回。`, view({ fresh: true }), { at: "full", kind: "ok" });
            return;
          }
          const depth = path.length;
          tried[depth].clear();
          for (let j = 0; j < n; j++) {
            if (used[j]) continue;
            used[j] = true; path.push(nums[j]);
            emit("选", `第 ${depth + 1} 个位置放 ${nums[j]}（没用过的数里从左往右挑）。`, view({ cur: j }), { at: "choose" });
            dfs();
            path.pop(); used[j] = false;
            tried[depth].add(j);
            emit("撤销", `回来，把 ${nums[j]} 拿出来、标回没用过，path = [${path.join(", ")}]。`, view({ undoNum: j, undoSlot: depth, undoVal: nums[j] }), { at: "undo", kind: "warn" });
          }
        };
        dfs();
        snap("完成", `一共 ${res.length} 个排列。`, view(), {
          at: "done",
          kind: "ok",
          ans: res.map((p) => p.slice()),
          facts: [["path", "空"], ["已收集", res.length], ["剩余空位", n]],
        });
      },
    },
  }, {
    key: "combine", t: "组合（带剪枝）",
    body: [
      "从 1 到 n 里选 k 个数的组合。和子集一样「只往后选」，只是只有选够 k 个才记答案。",
      "<b>剪枝</b>：还要选 <code>need = k - len(path)</code> 个，从 x 开始往后最多还有 <code>n - x + 1</code> 个数，不够就没必要再试了。所以 x 最大只到 <code>n - need + 1</code>。剪掉的是一定凑不满的分支，答案不变，但少走很多路。",
    ],
    points: [
      { t: "循环上界", body: "<code>range(start, n - need + 2)</code>：Python 的 range 不含右端，所以是 <code>+ 2</code>；其他语言写 <code>x &lt;= n - need + 1</code>。" },
      { t: "组合总和（39）", body: "数可以重复用时，下一层从 x 开始而不是 x + 1；再用「剩下的和」剪枝。" },
    ],
    codes: [{ t: "只往后选 + 剪枝", key: "combine", code: `
class Solution:
    def combine(self, n: int, k: int) -> List[List[int]]:
        res, path = [], []
        def dfs(start: int) -> None:
            if len(path) == k:                  # 选够了 #@full
                res.append(path[:])             #@full
                return                          #@full
            need = k - len(path)                # 还要选几个 #@choose
            for x in range(start, n - need + 2):    # 剪枝：后面的数要够选 #@choose
                path.append(x)                  #@choose
                dfs(x + 1)                      #@choose
                path.pop()                      #@undo
        dfs(1)                                  #@start
        return res                              #@done
` }],
    sig: { fn: "combine", params: ["int", "int"], ret: "List<List<int>>", cmp: "unordered" },
    call: (a) => [a.n, a.k],
    cases: [[1, 1], [4, 2], [5, 3], [4, 4]],
    gen: (R) => { const n = R.int(2, 5), k = R.int(1, n); return { args: { n, k }, note: `n = ${n}, k = ${k}` }; },
    demo: {
      legend: [["a", "刚选的数"], ["e", "path 里的数"], ["d", "剪掉：后面的数不够选了"], ["w", "撤销放回"], ["c", "选够收集"]],
      presets: [{ label: "n = 4, k = 2", args: { n: 4, k: 2 }, note: "n = 4, k = 2", expect: [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]] }, { label: "n = 4, k = 3", args: { n: 4, k: 3 }, note: "n = 4, k = 3", expect: [[1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]] }],
      build(a, snap) {
        const { n, k } = a, res = [], path = [];
        let hot = -1, undo = -1, cut = -1, from = 1;
        const pStr = () => (path.length ? `[${path.join(",")}]` : "空");
        let prevP = pStr(), prevNeed = k, prevTop = n - k + 1, prevRes = 0;
        const emit = (phase, msg, views, topVal, o = {}) => {
          const curP = pStr(), curNeed = k - path.length, curRes = res.length;
          const facts = o.facts || [
            curP !== prevP ? ["path", curP, prevP] : ["path", curP],
            curNeed !== prevNeed ? ["还需选 need", curNeed, prevNeed] : ["还需选 need", curNeed],
            topVal !== prevTop ? ["上界 top", topVal, prevTop] : ["上界 top", topVal],
            curRes !== prevRes ? ["已收集", curRes, prevRes] : ["已收集", curRes],
          ];
          prevP = curP; prevNeed = curNeed; prevTop = topVal; prevRes = curRes;
          snap(phase, msg, views, { ...o, facts });
        };
        const view = (opts = {}) => [
          {
            t: "array",
            label: "1 到 n",
            items: Array.from({ length: n }, (_, i) => {
              const val = i + 1;
              return {
                v: val,
                cls: val === undo ? "w" : val === hot ? "a" : path.includes(val) ? "e" : cut > 0 && val > cut ? "d" : val < from ? "d" : "",
              };
            }),
            idx: false,
            ptrs: {
              ...(from >= 1 && from <= n ? { start: from - 1 } : {}),
              ...(hot >= 1 ? { x: hot - 1 } : undo >= 1 ? { x: undo - 1 } : {}),
            },
          },
          {
            t: "chips",
            label: "path",
            items: path.map((v, idx) => ({ v, cls: opts.fresh ? "c" : hot >= 1 && idx === path.length - 1 ? "a" : "e" })),
            empty: "空",
          },
          {
            t: "chips",
            label: `res（${res.length} 个）`,
            items: res.map((p, idx) => ({ v: `[${p.join(",")}]`, cls: opts.fresh && idx === res.length - 1 ? "c" : "" })),
            empty: "空",
          },
        ];
        emit("开始", `从 1 到 ${n} 里选 ${k} 个数。`, view(), n - k + 1, {
          at: "start",
          facts: [["path", "空"], ["还需选 need", k], ["上界 top", n - k + 1], ["已收集", 0]],
        });
        const dfs = (start) => {
          if (path.length === k) {
            res.push(path.slice());
            hot = -1; undo = -1; cut = -1;
            emit("选够了", `path = [${path.join(", ")}] 选够了 ${k} 个，记进答案。`, view({ fresh: true }), n, { at: "full", kind: "ok" });
            return;
          }
          const need = k - path.length, top = n - need + 1;
          if (start > top && start <= n) {
            from = start; cut = top; hot = -1; undo = -1;
            emit("剪枝", `从 ${start} 开始最多只剩 ${n - start + 1} 个数，不够还需的 ${need} 个（上界 top = ${top}），直接剪枝返回。`, view(), top, { at: "choose", kind: "warn" });
            return;
          }
          for (let x = start; x <= top; x++) {
            path.push(x); hot = x; undo = -1; cut = top; from = start;
            emit("选", `还要选 ${need} 个，x 最多到 ${n} - ${need} + 1 = ${top}${top < n ? `（${top + 1} 以后剪掉了）` : ""}。选 ${x}，下一层从 ${x + 1} 开始。`, view(), top, { at: "choose" });
            dfs(x + 1);
            path.pop(); hot = -1; undo = x; cut = top; from = start;
            emit("撤销", `回来，把 ${x} 拿出来。`, view(), top, { at: "undo", kind: "warn" });
          }
        };
        dfs(1);
        from = 1; hot = -1; undo = -1; cut = -1;
        snap("完成", `一共 ${res.length} 个组合。`, view(), {
          at: "done",
          kind: "ok",
          ans: res.map((p) => p.slice()),
          facts: [["path", "空"], ["已收集", res.length]],
        });
      },
    },
  }],
};
