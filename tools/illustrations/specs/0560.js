module.exports = {
  id: 560, name: "和为 K 的子数组", title: "和为 K 的子数组图解", level: "中等", topic: "子串",
  h1: "和为 K 的子数组，两个前缀和相减",
  lede: "一段子数组的和，等于两个前缀和的差。走到某个位置时，只要知道前面有几个前缀和等于「当前前缀和 − k」，就知道有几段以这里结尾的子数组和为 k。",
  hints: [
    { t: "子数组的和怎么表示", body: ["设 <code>pre[i]</code> 是前 i 个数的和，那么一段子数组的和就是 <code>pre[j] − pre[i]</code>。", "要找和为 <code>k</code> 的子数组，就是找满足 <code>pre[j] − pre[i] = k</code> 的一对 (i, j)。"] },
    { t: "变成两数之和", body: ["固定右端 <code>j</code>，需要的是 <code>pre[i] = pre[j] − k</code>。", "和「两数之和」一样：用哈希表记住前面出现过的前缀和。"] },
    { t: "记次数，不是记有没有", body: ["同一个前缀和可能出现多次（数组里有负数和 0），每一次都对应一段不同的子数组，所以哈希表存的是<strong>出现次数</strong>。", "一开始要放进 <code>{0: 1}</code>，表示一个数都不取时前缀和是 0。"] },
  ],
  codes: [{ t: "标准解法：前缀和 + 哈希表", code: `
class Solution:
    def subarraySum(self, nums: List[int], k: int) -> int:
        count = defaultdict(int)
        count[0] = 1                    # 空前缀
        pre = res = 0
        for x in nums:
            pre += x
            res += count[pre - k]       # 先查
            count[pre] += 1             # 再存
        return res
` }],
  pytest: `
s = Solution()
assert s.subarraySum([1,1,1], 2) == 2
assert s.subarraySum([1,2,3], 3) == 2
assert s.subarraySum([1,-1,0], 0) == 3
assert s.subarraySum([3,4,7,2,-3,1,4,2], 7) == 4
`,
  legend: [["a", "当前的数"], ["d", "已经加进前缀和"], ["k", "查到的前缀和"]],
  presets: [
    { label: "示例 2", args: { nums: [1, 2, 3], k: 3 }, note: "nums = [1,2,3], k = 3", expect: 2 },
    { label: "有负数", args: { nums: [3, 4, 7, 2, -3, 1, 4, 2], k: 7 }, note: "nums = [3,4,7,2,-3,1,4,2], k = 7", expect: 4 },
  ],
  build(a, snap) {
    const { nums, k } = a, count = new Map([[0, 1]]); let pre = 0, res = 0;
    const view = (i, hitKey) => [
      { t: "array", label: "nums", items: nums.map((v, j) => ({ v, cls: j === i ? "a" : j < i ? "d" : "" })), ptrs: { i: i >= 0 && i < nums.length ? i : null } },
      { t: "chips", label: "哈希表 count（前缀和 → 出现次数）", items: [...count].map(([s, c]) => ({ v: `${s} → ${c}`, cls: s === hitKey ? "k" : "" })) },
    ];
    const facts = () => [["k", k], ["前缀和", pre], ["答案", res]];
    snap("开始", "哈希表里先放 0 → 1：一个数都不取时前缀和是 0，出现了 1 次。", view(-1), { facts: facts() });
    nums.forEach((x, i) => {
      pre += x;
      const need = pre - k, c = count.get(need) || 0;
      res += c;
      snap("先查", `加上 ${x}，前缀和变成 ${pre}。需要找之前等于 ${pre} − ${k} = <b>${need}</b> 的前缀和，` + (c ? `有 ${c} 个，说明有 ${c} 段以这里结尾的子数组和为 ${k}，答案加 ${c}。` : "没有。"), view(i, c ? need : undefined), { kind: c ? "ok" : "", facts: facts() });
      count.set(pre, (count.get(pre) || 0) + 1);
      snap("再存", `把当前前缀和 ${pre} 的出现次数加 1。`, view(i), { facts: facts() });
    });
    snap("完成", `一共有 <b>${res}</b> 段子数组的和等于 ${k}。`, view(nums.length), { kind: "ok", ans: res, facts: facts() });
  },
  points: [
    { t: "别忘了 count[0] = 1", body: "没有它，从下标 0 开始的子数组（前缀本身等于 k）会被漏掉。" },
    { t: "先查再存", body: "先存再查的话，k = 0 时会把「空子数组」也算进去。" },
    { t: "为什么不能用滑动窗口", body: "数组里有负数，窗口变长时和不一定变大，滑动窗口的单调性不成立。" },
  ],
};
