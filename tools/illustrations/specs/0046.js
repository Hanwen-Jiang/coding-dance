module.exports = {
  id: 46, name: "全排列", title: "全排列图解", level: "中等", topic: "回溯",
  h1: "全排列，一位一位地填",
  lede: "排列就是把 n 个位置依次填满。每一位都从还没用过的数里挑一个，填完一种就退回去换下一个。用一个 used 数组记住哪些数已经用了。",
  hints: [
    { t: "把问题看成填空", body: ["有 n 个空位，从左往右填。第一位有 n 种选法，第二位有 n − 1 种……", "每一位要知道哪些数已经被前面用掉了。"] },
    { t: "用 used 数组记状态", body: ["<code>used[i]</code> 表示 <code>nums[i]</code> 是否已经在 path 里。", "选一个没用过的数：标记 <code>used[i] = True</code>，放进 path，递归；回来后撤销这两步。"] },
    { t: "什么时候收集", body: ["path 长度等于 n，说明每一位都填好了，收集一份拷贝。"] },
  ],
  codes: [{ t: "标准解法：回溯 + used 数组", code: `
class Solution:
    def permute(self, nums: List[int]) -> List[List[int]]:
        res, path, used = [], [], [False] * len(nums)   #@init

        def dfs():
            if len(path) == len(nums):      #@collect
                res.append(path[:])         #@collect
                return                      #@collect
            for i, x in enumerate(nums):
                if used[i]:
                    continue
                used[i] = True              #@choose
                path.append(x)              #@choose
                dfs()
                path.pop()                  # 撤销选择
                used[i] = False

        dfs()                               #@init
        return res                          #@done
` }, { t: "简洁写法：第一位选谁 + 剩下的全排列", kind: "elegant", note: "先定第一位是 x，再把剩下的数全排列，拼在 x 后面。", code: `
class Solution:
    def permute(self, nums: List[int]) -> List[List[int]]:
        if len(nums) <= 1:
            return [nums[:]]
        return [[x] + p
                for i, x in enumerate(nums)
                for p in self.permute(nums[:i] + nums[i + 1:])]
` }],
  pytest: `
s = Solution()
assert s.permute([1,2,3]) == [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]
assert s.permute([0,1]) == [[0,1],[1,0]]
assert s.permute([1]) == [[1]]
assert len(s.permute([1,2,3,4,5])) == 120
`,
  // 各语言都按下标从小到大挑数，得到的顺序和 Python 一样，所以按顺序比
  sig: { fn: "permute", params: ["int[]"], ret: "List<List<int>>" },
  call: (a) => [a.nums],
  cases: [[[1]], [[0, 1]], [[5, -1, 3, 0]]],
  legend: [["a", "这一步选的数"], ["e", "已在 path 中"], ["d", "已用掉 / 本位已试"], ["w", "撤销放回"], ["c", "填满收集"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 2, 3] }, note: "nums = [1,2,3]", expect: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]] },
    { label: "示例 2", args: { nums: [0, 1] }, note: "nums = [0,1]", expect: [[0, 1], [1, 0]] },
  ],
  build(a, snap) {
    const nums = a.nums, n = nums.length, used = nums.map(() => false), path = [], res = [];
    const tried = Array.from({ length: n }, () => new Set());
    const pStr = () => (path.length ? `[${path.join(",")}]` : "空");
    let prevP = pStr(), prevF = 0, prevR = n;
    const emit = (phase, msg, views, o = {}) => {
      const curP = pStr(), curF = res.length, curR = n - path.length;
      const facts = o.facts || [
        ["path", curP, prevP],
        ["已找到", curF, prevF],
        ["剩余", curR, prevR],
      ];
      prevP = curP; prevF = curF; prevR = curR;
      snap(phase, msg, views, { ...o, facts });
    };
    const view = (opts = {}) => {
      const depth = path.length;
      const prevSlot = opts.prevSlot || {};
      return [
        {
          t: "array",
          label: "nums（灰色的已经用掉或本位已试过）",
          items: nums.map((v, i) => ({
            v,
            cls: i === opts.undoNum ? "w"
              : i === opts.cur ? "a"
              : used[i] || (depth < n && tried[depth].has(i)) ? "d"
              : "",
          })),
          ptrs: { i: opts.cur >= 0 ? opts.cur : opts.undoNum >= 0 ? opts.undoNum : null },
        },
        {
          t: "array",
          label: "path（正在填的排列）",
          items: Array.from({ length: n }, (_, k) => ({
            v: k < path.length ? path[k] : "",
            ...(prevSlot[k] !== undefined ? { prev: prevSlot[k] } : {}),
            cls: opts.undoSlot === k ? "w"
              : k < path.length ? (opts.fresh ? "c" : k === path.length - 1 && opts.cur >= 0 ? "a" : "e")
              : "",
          })),
          idx: true,
        },
        {
          t: "chips",
          label: "已收集",
          items: res.map((r, k) => ({ v: `[${r.join(",")}]`, cls: opts.fresh && k === res.length - 1 ? "c" : "" })),
          empty: "还没有",
        },
      ];
    };
    emit("开始", `有 ${n} 个空位，从左往右填。每一位从还没用过的数里挑。`, view(), { at: "init", facts: [["path", "空"], ["已找到", 0], ["剩余", n]] });
    const dfs = () => {
      if (path.length === n) {
        res.push(path.slice());
        emit("收集", `${n} 个位置都填好了，得到 <b>[${path.join(",")}]</b>。收进结果后回溯。`, view({ fresh: true }), { at: "collect", kind: "ok" });
        return;
      }
      const depth = path.length;
      tried[depth].clear();
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = true; path.push(nums[i]);
        emit(`填第 ${depth + 1} 位`, `第 ${depth + 1} 位填 <b>${nums[i]}</b>，标记 used[${i}] = True，递归下一位。`, view({ cur: i, prevSlot: { [depth]: "" } }), { at: "choose" });
        dfs();
        path.pop(); used[i] = false;
        tried[depth].add(i);
        emit(`撤销第 ${depth + 1} 位`, `把 <b>${nums[i]}</b> 从第 ${depth + 1} 位拿出来并恢复 used[${i}] = False。`, view({ undoNum: i, undoSlot: depth, prevSlot: { [depth]: nums[i] } }), { at: "choose", kind: "warn" });
      }
    };
    dfs();
    snap("完成", `一共 ${res.length} 个排列，正好是 ${n}! 个。`, view(), { at: "done", kind: "ok", ans: res.map((r) => r.slice()), facts: [["path", "空"], ["已找到", res.length], ["剩余", n]] });
  },
  points: [
    { t: "撤销要成对", body: "<code>used[i] = True</code> 和 <code>path.append</code> 是一对，递归回来后两个都要撤销。" },
    { t: "收集时要拷贝", body: "<code>res.append(path[:])</code>，否则后面回溯会把已经收集的结果改掉。" },
    { t: "复杂度", body: "一共 n! 个排列，每个长度 n，时间 O(n·n!)。递归深度 n。" },
  ],
};
