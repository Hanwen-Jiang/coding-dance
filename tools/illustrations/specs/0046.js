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
        res, path, used = [], [], [False] * len(nums)

        def dfs():
            if len(path) == len(nums):
                res.append(path[:])
                return
            for i, x in enumerate(nums):
                if used[i]:
                    continue
                used[i] = True
                path.append(x)
                dfs()
                path.pop()                  # 撤销选择
                used[i] = False

        dfs()
        return res
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
  legend: [["a", "这一步选的数"], ["d", "已经用掉"], ["c", "填满了"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 2, 3] }, note: "nums = [1,2,3]", expect: [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]] },
    { label: "示例 2", args: { nums: [0, 1] }, note: "nums = [0,1]", expect: [[0, 1], [1, 0]] },
  ],
  build(a, snap) {
    const nums = a.nums, n = nums.length, used = nums.map(() => false), path = [], res = [];
    const view = (cur, done) => [
      { t: "array", label: "nums（灰色的已经用掉）", items: nums.map((v, i) => ({ v, cls: i === cur ? "a" : used[i] ? "d" : "" })), ptrs: {} },
      { t: "array", label: "path（正在填的排列）", items: Array.from({ length: n }, (_, k) => ({ v: k < path.length ? path[k] : "", cls: k < path.length ? (done ? "c" : k === path.length - 1 && cur >= 0 ? "a" : "e") : "" })), idx: true },
      { t: "chips", label: "已收集", items: res.map((r) => `[${r.join(",")}]`), empty: "还没有" },
    ];
    snap("开始", `有 ${n} 个空位，从左往右填。每一位从还没用过的数里挑。`, view(-1));
    const dfs = () => {
      if (path.length === n) { res.push(path.slice()); snap("收集", `${n} 个位置都填好了，得到 <b>[${path.join(",")}]</b>。`, view(-1, true), { kind: "ok", facts: [["已收集", res.length]] }); return; }
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = true; path.push(nums[i]);
        snap("填第 " + path.length + " 位", `第 ${path.length} 位填 <b>${nums[i]}</b>，把它标记成用过。`, view(i), { facts: [["已收集", res.length]] });
        dfs();
        path.pop(); used[i] = false;
      }
    };
    dfs();
    snap("完成", `一共 ${res.length} 个排列，正好是 ${n}! 个。`, view(-1), { kind: "ok", ans: res.map((r) => r.slice()), facts: [["已收集", res.length]] });
  },
  points: [
    { t: "撤销要成对", body: "<code>used[i] = True</code> 和 <code>path.append</code> 是一对，递归回来后两个都要撤销。" },
    { t: "收集时要拷贝", body: "<code>res.append(path[:])</code>，否则后面回溯会把已经收集的结果改掉。" },
    { t: "复杂度", body: "一共 n! 个排列，每个长度 n，时间 O(n·n!)。递归深度 n。" },
  ],
};
