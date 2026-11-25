module.exports = {
  id: 1, name: "两数之和", title: "两数之和图解", level: "简单", topic: "哈希",
  h1: "两数之和，边走边记",
  lede: "暴力做法是两层循环找一对数。换个问法：走到一个数 x 时，只需要知道 target − x 之前有没有出现过。用哈希表把走过的数记下来，一遍就够了。",
  hints: [
    { t: "把找一对数变成找一个数", body: ["固定当前的数 <code>x</code>，要找的另一个数就确定了，是 <code>target - x</code>。", "问题变成：这个数在前面出现过吗？出现在哪个下标？"] },
    { t: "用什么查得最快", body: ["哈希表（Python 的 <code>dict</code>）查一个值是否存在是 <code>O(1)</code>。", "键存数值，值存下标，因为题目要返回的是下标。"] },
    { t: "先查再存", body: ["对每个数，<strong>先查</strong>哈希表里有没有 <code>target - x</code>，没有<strong>再把自己存进去</strong>。", "顺序反过来的话，比如 <code>target = 6</code>、当前的数是 3，会在哈希表里查到刚存进去的自己，把同一个数用了两次。"] },
  ],
  codes: [{ t: "标准解法：一遍哈希表", kind: "elegant", code: `
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}                       # 数值 -> 下标 #@init
        for i, x in enumerate(nums):
            if target - x in seen:      # 先查 #@check
                return [seen[target - x], i]    #@found
            seen[x] = i                 # 再存 #@save
` }],
  sig: { fn: "twoSum", params: ["int[]", "int"], ret: "int[]" },
  call: (a) => [a.nums, a.target],
  pytest: `
s = Solution()
assert s.twoSum([2,7,11,15], 9) == [0,1]
assert s.twoSum([3,2,4], 6) == [1,2]
assert s.twoSum([3,3], 6) == [0,1]
`,
  legend: [["a", "当前的数 / 刚存入"], ["d", "已存入哈希表"], ["c", "找到的一对"]],
  presets: [
    { label: "示例 1", args: { nums: [2, 7, 11, 15], target: 9 }, note: "nums = [2,7,11,15], target = 9", expect: [0, 1] },
    { label: "示例 2", args: { nums: [3, 2, 4], target: 6 }, note: "nums = [3,2,4], target = 6", expect: [1, 2] },
    { label: "答案靠后", args: { nums: [1, 5, 8, 3, 9, 4], target: 13 }, note: "nums = [1,5,8,3,9,4], target = 13", expect: [1, 2] },
  ],
  build(a, snap) {
    const { nums, target } = a, seen = new Map();
    const view = (i, hit, opts = {}) => [
      {
        t: "array",
        label: "nums",
        items: nums.map((v, j) => ({ v, cls: hit && (j === i || j === hit[0]) ? "c" : j === i ? "a" : j < i ? "d" : "" })),
        ptrs: { i: i >= 0 && i < nums.length ? i : null },
      },
      {
        t: "chips",
        label: "哈希表 seen（数值 → 下标）",
        items: [...seen].map(([k, v]) => ({ v: `${k} → ${v}`, cls: hit && v === hit[0] ? "c" : opts.justSaved === k ? "a" : "" })),
        empty: "空",
      },
    ];
    let prevX = "—", prevNeed = "—";
    snap("开始", `目标是找两个数加起来等于 <b>${target}</b>。从左往右走，哈希表一开始是空的。`, view(-1), {
      at: "init",
      facts: [["target", target], ["当前 x", "—"], ["需要", "—"], ["已存", 0]],
    });
    for (let i = 0; i < nums.length; i++) {
      const x = nums[i], need = target - x;
      if (seen.has(need)) {
        const hit = [seen.get(need), i];
        snap("找到配对", `当前 ${x}，需要 ${target} − ${x} = <b>${need}</b>。哈希表里已有 ${need}（下标 ${hit[0]}），答案是 [${hit[0]}, ${i}]。`, view(i, hit), {
          at: ["check", "found"],
          kind: "ok",
          ans: hit.slice(),
          facts: [["target", target], ["当前 x", x, prevX], ["需要", need, prevNeed], ["已存", seen.size]],
        });
        return;
      }
      snap("先查哈希表", `当前 ${x}，需要 ${target} − ${x} = <b>${need}</b>。哈希表里还没有 ${need}。`, view(i), {
        at: "check",
        facts: [["target", target], ["当前 x", x, prevX], ["需要", need, prevNeed], ["已存", seen.size]],
      });
      const oldSize = seen.size;
      seen.set(x, i);
      snap("再存入哈希表", `把 ${x} → ${i} 记进哈希表，留给后面的数来查。`, view(i, null, { justSaved: x }), {
        at: "save",
        facts: [["target", target], ["当前 x", x], ["需要", need], ["已存", seen.size, oldSize]],
      });
      prevX = x; prevNeed = need;
    }
  },
  points: [
    { t: "先查再存", body: "先查后存可以保证查到的一定是前面的数，不会把自己和自己配对。" },
    { t: "返回的是下标", body: "所以哈希表的值要存下标。也因此不能先排序再用双指针，排序会打乱下标。" },
    { t: "复杂度", body: "时间 O(n)，空间 O(n)。用空间换掉了暴力解法里的内层循环。" },
  ],
};
