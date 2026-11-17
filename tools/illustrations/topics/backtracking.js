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
      legend: [["a", "刚选的数"], ["e", "path 里的数"], ["d", "这一层不能再选（在 i 前面）"]],
      presets: [{ label: "示例 1", args: { nums: [1, 2, 3] }, note: "nums = [1,2,3]", expect: [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]] }],
      build(a, snap) {
        const nums = a.nums, res = [], path = [], idx = [];
        let from = 0, hot = -1;
        const view = () => [
          { t: "array", label: `nums（这一层从下标 ${from} 开始选）`, items: nums.map((v, k) => ({ v, cls: k === hot ? "a" : idx.includes(k) ? "e" : k < from ? "d" : "" })) },
          { t: "chips", label: "path", items: path.slice(), empty: "空" },
          { t: "chips", label: `res（${res.length} 个）`, items: res.map((p) => `[${p.join(",")}]`), empty: "空" },
        ];
        snap("开始", "从下标 0 开始，path 是空的。", view(), { at: "start" });
        const dfs = (i) => {
          from = i; hot = -1; res.push(path.slice());
          snap("记一个子集", `进入 dfs(${i})：当前 path = [${path.join(", ")}] 就是一个子集，记进答案。`, view(), { at: "record" });
          for (let j = i; j < nums.length; j++) {
            path.push(nums[j]); idx.push(j); hot = j; from = i;
            snap("选", `选 nums[${j}] = ${nums[j]}，下一层只能从 ${j + 1} 开始选。`, view(), { at: "choose" });
            dfs(j + 1);
            path.pop(); idx.pop(); from = i; hot = -1;
            snap("撤销", `从 dfs(${j + 1}) 回来，把 ${nums[j]} 拿出来，path = [${path.join(", ")}]，换下一个。`, view(), { at: "undo" });
          }
        };
        dfs(0);
        from = 0;
        snap("完成", `一共 ${res.length} 个子集。`, view(), { at: "done", kind: "ok", ans: res.map((p) => p.slice()) });
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
      legend: [["a", "刚选的数"], ["e", "已经用过（在 path 里）"]],
      presets: [{ label: "示例 1", args: { nums: [1, 2, 3] }, note: "nums = [1,2,3]", expect: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]] }],
      build(a, snap) {
        const nums = a.nums, n = nums.length, res = [], path = [], used = new Array(n).fill(false);
        let hot = -1;
        const view = () => [
          { t: "array", label: "nums（蓝底的已经用过）", items: nums.map((v, k) => ({ v, cls: k === hot ? "a" : used[k] ? "e" : "" })) },
          { t: "chips", label: "path", items: path.slice(), empty: "空" },
          { t: "chips", label: `res（${res.length} 个）`, items: res.map((p) => `[${p.join(",")}]`), empty: "空" },
        ];
        snap("开始", "path 是空的，所有数都还没用过。", view(), { at: "start" });
        const dfs = () => {
          if (path.length === n) { res.push(path.slice()); hot = -1; snap("放满了", `path = [${path.join(", ")}] 放满了 ${n} 个数，是一个排列，记进答案，返回。`, view(), { at: "full" }); return; }
          for (let j = 0; j < n; j++) {
            if (used[j]) continue;
            used[j] = true; path.push(nums[j]); hot = j;
            snap("选", `第 ${path.length} 个位置放 ${nums[j]}（没用过的数里从左往右挑）。`, view(), { at: "choose" });
            dfs();
            path.pop(); used[j] = false; hot = -1;
            snap("撤销", `回来，把 ${nums[j]} 拿出来、标回没用过，path = [${path.join(", ")}]。`, view(), { at: "undo" });
          }
        };
        dfs();
        snap("完成", `一共 ${res.length} 个排列。`, view(), { at: "done", kind: "ok", ans: res.map((p) => p.slice()) });
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
      legend: [["a", "刚选的数"], ["e", "path 里的数"], ["d", "剪掉：后面的数不够选了"]],
      presets: [{ label: "n = 4, k = 2", args: { n: 4, k: 2 }, note: "n = 4, k = 2", expect: [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]] }, { label: "n = 4, k = 3", args: { n: 4, k: 3 }, note: "n = 4, k = 3", expect: [[1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]] }],
      build(a, snap) {
        const { n, k } = a, res = [], path = [];
        let hot = -1, cut = -1, from = 1;
        const view = () => [
          { t: "array", label: "1 到 n", items: Array.from({ length: n }, (_, i) => ({ v: i + 1, cls: i + 1 === hot ? "a" : path.includes(i + 1) ? "e" : cut > 0 && i + 1 > cut ? "d" : i + 1 < from ? "" : "" })), idx: false },
          { t: "chips", label: "path", items: path.slice(), empty: "空" },
          { t: "chips", label: `res（${res.length} 个）`, items: res.map((p) => `[${p.join(",")}]`), empty: "空" },
        ];
        snap("开始", `从 1 到 ${n} 里选 ${k} 个数。`, view(), { at: "start" });
        const dfs = (start) => {
          if (path.length === k) { res.push(path.slice()); hot = -1; cut = -1; snap("选够了", `path = [${path.join(", ")}] 选够了 ${k} 个，记进答案。`, view(), { at: "full" }); return; }
          const need = k - path.length, top = n - need + 1;
          for (let x = start; x <= top; x++) {
            path.push(x); hot = x; cut = top; from = start;
            snap("选", `还要选 ${need} 个，x 最多到 ${n} - ${need} + 1 = ${top}${top < n ? `（${top + 1} 以后剪掉了）` : ""}。选 ${x}，下一层从 ${x + 1} 开始。`, view(), { at: "choose" });
            dfs(x + 1);
            path.pop(); hot = -1; cut = -1;
            snap("撤销", `回来，把 ${x} 拿出来。`, view(), { at: "undo" });
          }
        };
        dfs(1);
        snap("完成", `一共 ${res.length} 个组合。`, view(), { at: "done", kind: "ok", ans: res.map((p) => p.slice()) });
      },
    },
  }],
};
