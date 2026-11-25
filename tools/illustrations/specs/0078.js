module.exports = {
  id: 78, name: "子集", title: "子集图解", level: "中等", topic: "回溯",
  h1: "子集，每个节点都是一个答案",
  lede: "和组合、排列不同，子集不用等「填满」才收集：递归树上的每一个节点都是一个子集。只要规定后面选的数下标比前面大，就不会重复。",
  hints: [
    { t: "每个数选或不选", body: ["n 个数，每个都有选、不选两种状态，一共 <code>2ⁿ</code> 个子集。"] },
    { t: "回溯：进门就收集", body: ["<code>dfs(start)</code>：先把当前的 path 收集起来，然后从 <code>start</code> 往后挑一个数放进去，递归 <code>dfs(i + 1)</code>。", "下一个数的下标总比上一个大，所以 [1,2] 和 [2,1] 不会同时出现。"] },
    { t: "也可以不用递归", body: ["从 <code>[[]]</code> 开始。每来一个数 x，把已有的每个子集复制一份并加上 x。", "处理完所有数，就得到全部子集。"] },
  ],
  codes: [{ t: "标准解法：回溯", code: `
class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        res, path = [], []              #@init

        def dfs(start):
            res.append(path[:])             # 每个节点都是一个子集 #@collect
            for i in range(start, len(nums)):
                path.append(nums[i])        #@pick
                dfs(i + 1)                  # 下一个只能从后面选 #@pick
                path.pop()

        dfs(0)                          #@init
        return res                      #@done
` }, { t: "简洁写法：逐个加入", key: "iter", kind: "elegant", note: "已有的每个子集都可以选择再加上 x，于是每处理一个数，子集个数翻一倍。", code: `
class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        res = [[]]                          #@init
        for x in nums:
            res += [s + [x] for s in res]   #@add
        return res                          #@done
` }],
  pytest: `
s = Solution()
norm = lambda r: sorted(sorted(x) for x in r)
assert norm(s.subsets([1,2,3])) == norm([[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]])
assert norm(s.subsets([0])) == [[],[0]]
assert len(s.subsets(list(range(10)))) == 1024
`,
  sig: { fn: "subsets", params: ["int[]"], ret: "List<List<int>>", cmp: "unordered" },
  call: (a) => [a.nums],
  cases: [[[9, 0, -3, 4, 7]]],
  method: "回溯",
  cmp: "unordered",
  legend: [["a", "刚放进来的数"], ["e", "这一层可选范围 / path"], ["w", "撤销放回"], ["d", "已试过"], ["c", "刚收集的子集"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 2, 3] }, note: "nums = [1,2,3]", expect: [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]] },
    { label: "示例 2", args: { nums: [0] }, note: "nums = [0]", expect: [[], [0]] },
  ],
  build(a, snap) {
    const nums = a.nums, res = [], path = [];
    const pStr = () => (path.length ? `[${path.join(",")}]` : "空");
    let prevP = pStr(), prevS = "—", prevC = 0;
    const emit = (phase, msg, views, curStart, o = {}) => {
      const curP = pStr(), curC = res.length;
      const facts = o.facts || [
        curP !== prevP ? ["path", curP, prevP] : ["path", curP],
        curStart !== prevS ? ["start", curStart, prevS] : ["start", curStart],
        curC !== prevC ? ["已收集", curC, prevC] : ["已收集", curC],
      ];
      prevP = curP; prevS = curStart; prevC = curC;
      snap(phase, msg, views, { ...o, facts });
    };
    const view = (opts = {}) => {
      const start = opts.start ?? -1, pick = opts.pick ?? -1, undo = opts.undo ?? -1, curI = opts.curI ?? start;
      return [
        {
          t: "array",
          label: "nums",
          items: nums.map((v, i) => ({
            v,
            cls: i === undo ? "w"
              : i === pick ? "a"
              : start >= 0 && i >= curI ? "e"
              : start >= 0 ? "d"
              : "",
          })),
          ptrs: {
            start: start >= 0 && start < nums.length ? start : null,
            ...(pick >= 0 ? { i: pick } : undo >= 0 ? { i: undo } : {}),
          },
        },
        {
          t: "chips",
          label: "path",
          items: path.map((v, k) => ({
            v,
            cls: opts.fresh ? "c" : pick >= 0 && k === path.length - 1 ? "a" : "e",
          })),
          empty: "空",
        },
        {
          t: "chips",
          label: "已收集的子集",
          items: res.map((r, k) => ({ v: `[${r.join(",")}]`, cls: opts.fresh && k === res.length - 1 ? "c" : "" })),
          empty: "还没有",
        },
      ];
    };
    emit("开始", "从空集开始。每进入一层递归，先把当前的 path 当成一个子集收集起来。", view(), "—", {
      at: "init",
      facts: [["path", "空"], ["start", "—"], ["已收集", 0]],
    });
    const dfs = (start) => {
      res.push(path.slice());
      emit(
        "收集",
        `进入 dfs(${start})，先收集 <b>[${path.join(",")}]</b>。` + (start < nums.length ? `接着从下标 ${start} 往后挑一个数。` : "后面没有数可挑了，返回。"),
        view({ start, curI: start, fresh: true }),
        start,
        { at: "collect", kind: "ok" },
      );
      for (let i = start; i < nums.length; i++) {
        path.push(nums[i]);
        emit(
          "放入",
          `把 ${nums[i]} 放进 path，变成 [${path.join(",")}]，然后进入 dfs(${i + 1})。`,
          view({ start, pick: i, curI: i }),
          start,
          { at: "pick" },
        );
        dfs(i + 1);
        const popped = path.pop();
        emit(
          "撤销",
          `从 dfs(${i + 1}) 返回，把 ${popped} 从 path 拿出来，path 回到 [${path.join(",")}]` + (i + 1 < nums.length ? `，继续看下一个数 ${nums[i + 1]}。` : "，本层结束。"),
          view({ start, undo: i, curI: i + 1 }),
          start,
          { at: "pick", kind: "warn" },
        );
      }
    };
    dfs(0);
    snap("完成", `一共 ${res.length} 个子集，正好是 2^${nums.length}。`, view(), {
      at: "done",
      kind: "ok",
      ans: res.map((r) => r.slice()),
      facts: [["path", "空"], ["已收集", res.length]],
    });
  },
  alts: [{
    t: "逐个加入",
    code: "iter",
    note: "和简洁写法一样：从只有空集开始。每来一个数 x，已有的每个子集都可以选择加上 x，于是子集个数翻一倍。",
    legend: [["a", "正在加入的数"], ["d", "已处理"], ["c", "这一轮新生成的子集"]],
    build(a, snap) {
      const nums = a.nums; let res = [[]], fresh = 0, prevX = "—";
      const view = (k) => [
        {
          t: "array",
          label: "nums",
          items: nums.map((v, i) => ({ v, cls: i === k ? "a" : i < k ? "d" : "" })),
          ptrs: { x: k >= 0 && k < nums.length ? k : null },
        },
        {
          t: "chips",
          label: "res",
          items: res.map((r, i) => ({ v: `[${r.join(",")}]`, cls: i >= res.length - fresh ? "c" : "" })),
        },
      ];
      snap("开始", "res 里只有一个空集。", view(-1), {
        at: "init",
        facts: [["当前 x", "—"], ["新增", "—"], ["子集个数", 1]],
      });
      nums.forEach((x, k) => {
        const oldLen = res.length;
        const add = res.map((s) => [...s, x]);
        res = res.concat(add); fresh = add.length;
        snap(
          `加入 ${x}`,
          `已有的 ${add.length} 个子集每个都加上 ${x}，得到 ${add.map((s) => `[${s.join(",")}]`).join("、")}，接在 res 后面。子集个数翻倍成 ${res.length}。`,
          view(k),
          {
            at: "add",
            facts: [
              x !== prevX ? ["当前 x", x, prevX] : ["当前 x", x],
              ["新增", `+${add.length}`],
              ["子集个数", res.length, oldLen],
            ],
          },
        );
        prevX = x;
      });
      fresh = 0;
      snap("完成", `一共 ${res.length} 个子集，正好是 2^${nums.length}。`, view(nums.length), {
        at: "done",
        kind: "ok",
        ans: res.map((r) => r.slice()),
        facts: [["子集个数", res.length]],
      });
    },
  }],
  points: [
    { t: "收集放在循环前面", body: "子集没有「填满」的概念，进入函数就收集，空集也算一个。" },
    { t: "dfs(i + 1) 而不是 dfs(start + 1)", body: "下一层从刚选的数的后面开始，不是从这一层的起点后面开始。" },
    { t: "复杂度", body: "2ⁿ 个子集，每个平均长度 n/2，时间 O(n·2ⁿ)。" },
  ],
};
