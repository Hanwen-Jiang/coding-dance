module.exports = {
  id: 283, name: "移动零", title: "移动零图解", level: "简单", topic: "双指针",
  h1: "移动零，一个指针找，一个指针放",
  lede: "不用真的去挪每个 0。让一个指针记住下一个非零数该放的位置，另一个指针往前找非零数，找到就换过去。",
  hints: [
    { t: "换个角度", body: ["把 0 移到末尾，等于把所有非零数<strong>按原顺序</strong>挤到前面。", "所以只需要关心非零数该放到哪。"] },
    { t: "两个指针各管什么", body: ["<code>j</code>：下一个非零数应该放的位置。它左边全是已经排好的非零数。", "<code>i</code>：往前扫描，找非零数。"] },
    { t: "找到之后", body: ["<code>nums[i]</code> 非零时，和 <code>nums[j]</code> 交换，然后 <code>j</code> 右移一格。", "<code>j</code> 和 <code>i</code> 之间夹着的永远全是 0，所以换回来的一定是 0。"] },
  ],
  codes: [{ t: "标准解法：快慢指针交换", code: `
class Solution:
    def moveZeroes(self, nums: List[int]) -> None:
        j = 0                           # 下一个非零数放的位置 #@init
        for i in range(len(nums)):      #@scan
            if nums[i] != 0:            #@swap
                nums[i], nums[j] = nums[j], nums[i]     #@swap
                j += 1                  #@swap
` }, { t: "简洁写法：稳定排序", kind: "elegant", note: "key 是「是不是 0」，False 排在 True 前面。Python 的排序是稳定的，非零元素的相对顺序不变。时间 O(n log n)。", code: `
class Solution:
    def moveZeroes(self, nums: List[int]) -> None:
        nums.sort(key=lambda x: x == 0)
` }],
  pytest: `
for a, e in [([0,1,0,3,12],[1,3,12,0,0]), ([0],[0]), ([1,2,3],[1,2,3]), ([0,0,1],[1,0,0])]:
    Solution().moveZeroes(a); assert a == e
`,
  sig: { fn: "moveZeroes", params: ["int[]"], ret: "void" },
  call: (a) => [a.nums],
  cases: [[[0]], [[1]], [[0, 0, 1]]],
  legend: [["c", "已排好的非零数"], ["a", "i 正在看的数"], ["w", "j 和 i 之间的 0"]],
  presets: [
    { label: "示例 1", args: { nums: [0, 1, 0, 3, 12] }, note: "nums = [0,1,0,3,12]", expect: [1, 3, 12, 0, 0] },
    { label: "零更多", args: { nums: [4, 0, 0, 2, 0, 7, 1] }, note: "nums = [4,0,0,2,0,7,1]", expect: [4, 2, 7, 1, 0, 0, 0] },
  ],
  build(a, snap) {
    const n = a.nums.slice(); let j = 0;
    const view = (opts = {}) => {
      const i = opts.i ?? -1, prevMap = opts.prevMap || {};
      return [{
        t: "array",
        label: "nums",
        items: n.map((v, t) => ({
          v,
          ...(prevMap[t] !== undefined ? { prev: prevMap[t] } : {}),
          cls: t < j ? "c" : t === i ? "a" : t < i ? "w" : "",
        })),
        ptrs: { j, i: i >= 0 && i < n.length ? i : null },
        swaps: opts.swaps || [],
      }];
    };
    snap("开始", "j 指向下一个非零数该放的位置，i 从左往右扫描。", view(), { at: "init", facts: [["j", j]] });
    for (let i = 0; i < n.length; i++) {
      if (n[i] !== 0) {
        const same = i === j, x = n[i];
        if (same) {
          const pj = j;
          j++;
          snap(
            "原地留位并推进 j",
            `nums[${i}] = ${x} 非零，i 和 j 都在下标 ${i}，原地不动，j 右移到 ${j}。`,
            view({ i }),
            { at: "swap", facts: [["i", i], ["j", j, pj], ["nums[i]", x]] },
          );
        } else {
          snap(
            "发现非零数",
            `nums[${i}] = ${x} 非零，应该换到 j = ${j} 的位置（那里现在是 ${n[j]}）。`,
            view({ i }),
            { at: "swap", facts: [["i", i], ["j", j], ["nums[i]", x]] },
          );
          const oldI = n[i], oldJ = n[j], pj = j;
          [n[i], n[j]] = [n[j], n[i]];
          j++;
          snap(
            "交换并推进 j",
            `把 nums[${i}]（${oldI}）和 nums[${pj}]（${oldJ}）交换，${oldI} 来到下标 ${pj}，j 右移到 ${j}。`,
            view({ i, swaps: [[pj, i]], prevMap: { [pj]: oldJ, [i]: oldI } }),
            { at: "swap", facts: [["i", i], ["j", j, pj], ["已归位", oldI]] },
          );
        }
      } else {
        snap("跳过", `nums[${i}] 是 0，不处理，i 继续往前。j 留在 ${j} 等下一个非零数。`, view({ i }), { at: "scan", kind: "warn", facts: [["i", i], ["j", j], ["nums[i]", 0]] });
      }
    }
    snap("完成", `扫描结束。j 左边是所有非零数，顺序没变；右边全是 0。`, view({ i: n.length }), { at: [], kind: "ok", ans: n.slice(), facts: [["非零数个数 j", j]] });
  },
  points: [
    { t: "原地修改", body: "函数不返回任何东西，直接改 <code>nums</code>。不要新建数组再赋值给 <code>nums</code>。" },
    { t: "顺序不变", body: "非零数是按扫描顺序依次放到前面的，所以相对顺序自动保持。" },
    { t: "复杂度", body: "时间 O(n)，空间 O(1)。" },
  ],
};
