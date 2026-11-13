module.exports = {
  id: 169, name: "多数元素", title: "多数元素图解", level: "简单", topic: "技巧",
  h1: "多数元素，摩尔投票，两两抵消",
  lede: "多数元素出现了超过一半。让不同的数两两抵消：每次拿一个多数元素和一个别的数一起扔掉，多数元素一定是最后剩下的。实现时只需要一个候选人和一个票数。",
  hints: [
    { t: "抵消的直觉", body: ["把数组里两个不同的数同时删掉，多数元素仍然是剩下部分的多数元素。", "一直删到只剩一种数，它就是答案。"] },
    { t: "候选人和票数", body: ["<code>cand</code> 是当前候选人，<code>count</code> 是它还剩几票。", "下一个数等于 <code>cand</code> 就 +1，否则 -1（两两抵消）。<code>count</code> 为 0 时，下一个数成为新的候选人。"] },
    { t: "为什么最后一定是对的", body: ["多数元素的票数超过其他所有数之和，再怎么抵消也抵消不完。"] },
  ],
  codes: [{ t: "标准解法：摩尔投票", code: `
class Solution:
    def majorityElement(self, nums: List[int]) -> int:
        cand, count = None, 0
        for x in nums:
            if count == 0:
                cand = x                    # 票数归零，换候选人
            count += 1 if x == cand else -1 # 相同 +1，不同就抵消一票
        return cand
` }, { t: "简洁写法：排序取中间", kind: "elegant", note: "多数元素超过一半，排序后无论它在哪段，都一定覆盖正中间的位置。时间 O(n log n)。", code: `
class Solution:
    def majorityElement(self, nums: List[int]) -> int:
        return sorted(nums)[len(nums) // 2]
` }],
  pytest: `
s = Solution()
assert s.majorityElement([3,2,3]) == 3
assert s.majorityElement([2,2,1,1,1,2,2]) == 2
assert s.majorityElement([1]) == 1
assert s.majorityElement([6,5,5]) == 5
`,
  legend: [["a", "当前的数"], ["k", "看过的、和当前候选人相同的数"], ["d", "看过的其他数"]],
  presets: [
    { label: "示例 2", args: { nums: [2, 2, 1, 1, 1, 2, 2] }, note: "nums = [2,2,1,1,1,2,2]", expect: 2 },
    { label: "示例 1", args: { nums: [3, 2, 3] }, note: "nums = [3,2,3]", expect: 3 },
  ],
  build(a, snap) {
    const nums = a.nums; let cand = null, count = 0;
    const view = (i) => [{ t: "array", label: "nums", items: nums.map((v, k) => ({ v, cls: k === i ? "a" : k < i ? (v === cand ? "k" : "d") : "" })), ptrs: { i: i >= 0 ? i : null } }];
    const f = () => ({ facts: [["候选人", cand === null ? "—" : cand], ["票数", count]] });
    snap("开始", "还没有候选人，票数 0。", view(-1), f());
    nums.forEach((x, i) => {
      if (count === 0) { cand = x; count = 1; snap("新候选人", `票数是 0，${x} 成为新的候选人，票数 1。`, view(i), f()); }
      else if (x === cand) { count++; snap("+1", `${x} 和候选人相同，票数 +1，变成 ${count}。`, view(i), f()); }
      else { count--; snap("抵消", `${x} 和候选人 ${cand} 不同，两者抵消，票数 −1，变成 ${count}。`, view(i), { kind: count === 0 ? "warn" : "", ...f() }); }
    });
    snap("完成", `最后的候选人是 <b>${cand}</b>，它就是多数元素。`, view(-1), { kind: "ok", ans: cand, ...f() });
  },
  points: [
    { t: "票数为 0 时先换人", body: "先判断 count == 0 换候选人，再根据是否相同加减票数。" },
    { t: "题目保证存在", body: "所以不用再验证一遍。若不保证存在，最后要再数一次候选人出现的次数。" },
    { t: "复杂度", body: "摩尔投票时间 O(n)，空间 O(1)。" },
  ],
};
