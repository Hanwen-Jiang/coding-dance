module.exports = {
  id: 15, name: "三数之和", title: "三数之和图解", level: "中等", topic: "双指针",
  h1: "三数之和，排序后固定一个，剩下两个对撞",
  lede: "先排序。固定最小的那个数，剩下的问题就是在它右边找两个数凑出指定的和，用对撞双指针一遍就能找完。去重也靠排序：相同的数挨在一起，跳过就行。",
  hints: [
    { t: "先排序", body: ["题目返回的是数值不是下标，所以可以排序。", "排序后有两个好处：可以用双指针，以及重复的数会挨在一起，方便跳过。"] },
    { t: "固定一个，找两个", body: ["枚举第一个数 <code>nums[i]</code>，在它右边用 <code>l</code>、<code>r</code> 两个指针找和为 <code>-nums[i]</code> 的两个数。", "三数之和太小就 <code>l</code> 右移，太大就 <code>r</code> 左移。"] },
    { t: "怎么去重", body: ["第一个数：<code>nums[i]</code> 和前一个相同就跳过，否则会得到一模一样的三元组。", "找到一组答案后：<code>l</code> 和 <code>r</code> 都要跳过和刚才相同的值。"] },
  ],
  codes: [{ t: "标准解法：排序 + 双指针", code: `
class Solution:
    def threeSum(self, nums: List[int]) -> List[List[int]]:
        nums.sort()
        n, res = len(nums), []
        for i in range(n - 2):
            if nums[i] > 0:
                break                   # 最小的都大于 0，后面不可能了
            if i > 0 and nums[i] == nums[i - 1]:
                continue                # 第一个数去重
            l, r = i + 1, n - 1
            while l < r:
                s = nums[i] + nums[l] + nums[r]
                if s < 0:
                    l += 1
                elif s > 0:
                    r -= 1
                else:
                    res.append([nums[i], nums[l], nums[r]])
                    l += 1
                    r -= 1
                    while l < r and nums[l] == nums[l - 1]:
                        l += 1          # 第二个数去重
                    while l < r and nums[r] == nums[r + 1]:
                        r -= 1          # 第三个数去重
        return res
` }, { t: "简洁写法：固定一个数，剩下的用集合找", kind: "elegant", note: "固定 x 之后就是两数之和。结果放进集合去重，最后排序输出。同样是 O(n²)。", code: `
class Solution:
    def threeSum(self, nums: List[int]) -> List[List[int]]:
        nums.sort()
        res = set()
        for i, x in enumerate(nums):
            if i and x == nums[i - 1]:
                continue
            seen = set()
            for y in nums[i + 1:]:
                if -x - y in seen:
                    res.add((x, -x - y, y))
                seen.add(y)
        return sorted(map(list, res))
` }],
  pytest: `
s = Solution()
assert s.threeSum([-1,0,1,2,-1,-4]) == [[-1,-1,2],[-1,0,1]]
assert s.threeSum([0,1,1]) == []
assert s.threeSum([0,0,0]) == [[0,0,0]]
assert s.threeSum([0,0,0,0]) == [[0,0,0]]
assert s.threeSum([-2,0,0,2,2]) == [[-2,0,2]]
`,
  legend: [["b", "固定的第一个数"], ["a", "l 和 r"], ["c", "凑成 0 的一组"], ["d", "已经处理过"]],
  presets: [
    { label: "示例 1", args: { nums: [-1, 0, 1, 2, -1, -4] }, note: "nums = [-1,0,1,2,-1,-4]", expect: [[-1, -1, 2], [-1, 0, 1]] },
    { label: "重复更多", args: { nums: [-2, 0, 0, 2, 2, -2, 1, 1] }, note: "nums = [-2,0,0,2,2,-2,1,1]", expect: [[-2, 0, 2], [-2, 1, 1]] },
  ],
  build(a, snap) {
    const nums = a.nums.slice().sort((x, y) => x - y), n = nums.length, res = [];
    const view = (i, l, r, hit) => [
      { t: "array", label: "排序后的 nums", items: nums.map((v, t) => ({ v, cls: hit && (t === i || t === l || t === r) ? "c" : t === i ? "b" : t === l || t === r ? "a" : t < i ? "d" : "" })), ptrs: { i, l, r } },
      { t: "chips", label: "结果", items: res.map((t) => `[${t.join(", ")}]`), empty: "还没有" },
    ];
    snap("排序", `先排序，得到 [${nums.join(", ")}]。`, view(null, null, null));
    for (let i = 0; i < n - 2; i++) {
      if (nums[i] > 0) { snap("提前结束", `nums[${i}] = ${nums[i]} 已经大于 0，它后面的数更大，三个数不可能加起来等于 0。`, view(i, null, null), { kind: "warn" }); break; }
      if (i > 0 && nums[i] === nums[i - 1]) { snap("去重", `nums[${i}] = ${nums[i]} 和前一个数相同，以它开头的三元组前面已经找过了，<b>跳过</b>。`, view(i, null, null), { kind: "warn" }); continue; }
      let l = i + 1, r = n - 1;
      snap("固定第一个数", `固定 nums[${i}] = <b>${nums[i]}</b>，在它右边找两个数，和要等于 ${-nums[i]}。`, view(i, l, r));
      while (l < r) {
        const s = nums[i] + nums[l] + nums[r];
        if (s < 0) { snap("和太小", `${nums[i]} + ${nums[l]} + ${nums[r]} = ${s}，小于 0，需要更大的数，l 右移。`, view(i, l, r)); l++; }
        else if (s > 0) { snap("和太大", `${nums[i]} + ${nums[l]} + ${nums[r]} = ${s}，大于 0，需要更小的数，r 左移。`, view(i, l, r)); r--; }
        else {
          res.push([nums[i], nums[l], nums[r]]);
          snap("找到一组", `${nums[i]} + ${nums[l]} + ${nums[r]} = 0，记下 <b>[${nums[i]}, ${nums[l]}, ${nums[r]}]</b>。l、r 同时往里收，并跳过和刚才相同的值。`, view(i, l, r, true), { kind: "ok" });
          l++; r--;
          while (l < r && nums[l] === nums[l - 1]) l++;
          while (l < r && nums[r] === nums[r + 1]) r--;
        }
      }
    }
    snap("完成", `一共找到 <b>${res.length}</b> 组。`, view(null, null, null), { kind: "ok", ans: res });
  },
  points: [
    { t: "去重有三处", body: "第一个数、第二个数、第三个数都要跳过重复值。漏掉任何一处都会出现重复的三元组。" },
    { t: "i > 0 才比较前一个", body: "<code>nums[i] == nums[i-1]</code> 之前要先判断 <code>i > 0</code>，否则 i = 0 时会和最后一个数比。" },
    { t: "复杂度", body: "排序 O(n log n)，外层枚举 n 次、内层双指针 O(n)，总共 O(n²)。" },
  ],
};
