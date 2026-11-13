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
        res, path = [], []

        def dfs(start):
            res.append(path[:])             # 每个节点都是一个子集
            for i in range(start, len(nums)):
                path.append(nums[i])
                dfs(i + 1)                  # 下一个只能从后面选
                path.pop()

        dfs(0)
        return res
` }, { t: "简洁写法：逐个加入", kind: "elegant", note: "已有的每个子集都可以选择再加上 x，于是每处理一个数，子集个数翻一倍。", code: `
class Solution:
    def subsets(self, nums: List[int]) -> List[List[int]]:
        res = [[]]
        for x in nums:
            res += [s + [x] for s in res]
        return res
` }],
  pytest: `
s = Solution()
norm = lambda r: sorted(sorted(x) for x in r)
assert norm(s.subsets([1,2,3])) == norm([[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]])
assert norm(s.subsets([0])) == [[],[0]]
assert len(s.subsets(list(range(10)))) == 1024
`,
  legend: [["a", "刚放进来的数"], ["e", "这一层可以选的范围"], ["c", "收集的子集"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 2, 3] }, note: "nums = [1,2,3]", expect: [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]] },
    { label: "示例 2", args: { nums: [0] }, note: "nums = [0]", expect: [[], [0]] },
  ],
  build(a, snap) {
    const nums = a.nums, res = [], path = [];
    const view = (start, pick) => [
      { t: "array", label: "nums", items: nums.map((v, i) => ({ v, cls: i === pick ? "a" : start >= 0 && i >= start ? "e" : "" })), ptrs: { start: start >= 0 && start < nums.length ? start : null } },
      { t: "chips", label: "path", items: path.slice(), empty: "空" },
      { t: "chips", label: "已收集的子集", items: res.map((r, k) => ({ v: `[${r.join(",")}]`, cls: k === res.length - 1 && pick < 0 ? "c" : "" })), empty: "还没有" },
    ];
    snap("开始", "从空集开始。每进入一层递归，先把当前的 path 当成一个子集收集起来。", view(-1, -1));
    const dfs = (start) => {
      res.push(path.slice());
      snap("收集", `进入 dfs(${start})，先收集 <b>[${path.join(",")}]</b>。` + (start < nums.length ? `接着从下标 ${start} 往后挑一个数。` : "后面没有数可挑了，返回。"), view(start, -1), { facts: [["已收集", res.length]] });
      for (let i = start; i < nums.length; i++) {
        path.push(nums[i]);
        snap("放入", `把 ${nums[i]} 放进 path，变成 [${path.join(",")}]，然后进入 dfs(${i + 1})。`, view(start, i), { facts: [["已收集", res.length]] });
        dfs(i + 1);
        path.pop();
      }
    };
    dfs(0);
    snap("完成", `一共 ${res.length} 个子集，正好是 2^${nums.length}。`, view(-1, -1), { kind: "ok", ans: res.map((r) => r.slice()), facts: [["已收集", res.length]] });
  },
  points: [
    { t: "收集放在循环前面", body: "子集没有「填满」的概念，进入函数就收集，空集也算一个。" },
    { t: "dfs(i + 1) 而不是 dfs(start + 1)", body: "下一层从刚选的数的后面开始，不是从这一层的起点后面开始。" },
    { t: "复杂度", body: "2ⁿ 个子集，每个平均长度 n/2，时间 O(n·2ⁿ)。" },
  ],
};
