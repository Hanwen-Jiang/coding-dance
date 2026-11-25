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
        count = defaultdict(int)        #@init
        count[0] = 1                    # 空前缀 #@init
        pre = res = 0                   #@init
        for x in nums:                  #@query
            pre += x                    #@query
            res += count[pre - k]       # 先查 #@query
            count[pre] += 1             # 再存 #@store
        return res                      #@done
` }, { t: "简洁写法：accumulate + Counter", kind: "elegant", note: "accumulate 依次给出每个前缀和，Counter 查不到的键默认是 0。", code: `
from itertools import accumulate

class Solution:
    def subarraySum(self, nums: List[int], k: int) -> int:
        seen, res = Counter({0: 1}), 0
        for s in accumulate(nums):
            res += seen[s - k]
            seen[s] += 1
        return res
` }],
  pytest: `
s = Solution()
assert s.subarraySum([1,1,1], 2) == 2
assert s.subarraySum([1,2,3], 3) == 2
assert s.subarraySum([1,-1,0], 0) == 3
assert s.subarraySum([3,4,7,2,-3,1,4,2], 7) == 4
`,
  sig: { fn: "subarraySum", params: ["int[]", "int"], ret: "int" },
  call: (a) => [a.nums, a.k],
  cases: [[[1, 1, 1], 2], [[1], 0], [[1, -1, 0], 0], [[0, 0, 0], 0]],
  legend: [["a", "当前的数 / 刚更新"], ["d", "已经加进前缀和"], ["k", "命中的目标前缀和 pre−k"], ["c", "刚算出的前缀和（有命中）"]],
  presets: [
    { label: "示例 2", args: { nums: [1, 2, 3], k: 3 }, note: "nums = [1,2,3], k = 3", expect: 2 },
    { label: "有负数", args: { nums: [3, 4, 7, 2, -3, 1, 4, 2], k: 7 }, note: "nums = [3,4,7,2,-3,1,4,2], k = 7", expect: 4 },
  ],
  build(a, snap) {
    const { nums, k } = a, n = nums.length, count = new Map([[0, 1]]);
    const preArr = Array(n + 1).fill(null);
    preArr[0] = 0;
    let pre = 0, res = 0;
    const view = (i, opts = {}) => {
      const hitKey = opts.hitKey;
      const storedKey = opts.storedKey;
      const curPreIdx = opts.curPreIdx ?? -1;
      return [
        {
          t: "array",
          label: "nums",
          items: nums.map((v, j) => ({ v, cls: j === i ? "a" : j < i ? "d" : "" })),
          ptrs: { i: i >= 0 && i < n ? i : null },
        },
        {
          t: "array",
          label: "前缀和 pre（pre[0] = 0 表示空前缀）",
          items: preArr.map((v, j) => ({
            v: v === null ? "" : v,
            cls: j === curPreIdx ? (hitKey !== undefined ? "c" : "a")
              : hitKey !== undefined && v === hitKey && j < curPreIdx ? "k"
                : v !== null ? "d" : "",
          })),
          ptrs: curPreIdx >= 0 ? { pre: curPreIdx } : { pre: 0 },
          feeds: (opts.feeds || []).slice(),
        },
        {
          t: "chips",
          label: "哈希表 count（前缀和 → 出现次数）",
          items: [...count].map(([s, c]) => ({
            v: `${s} → ${c}`,
            cls: s === hitKey ? "k" : s === storedKey ? "a" : "",
          })),
        },
      ];
    };
    snap("开始", "哈希表里先放 0 → 1：一个数都不取时前缀和是 0，出现了 1 次。", view(-1), {
      at: "init",
      facts: [["k", k], ["前缀和", 0], ["查找 pre−k", -k], ["答案", 0]],
    });
    nums.forEach((x, i) => {
      const oldPre = pre, oldRes = res;
      pre += x;
      preArr[i + 1] = pre;
      const need = pre - k, c = count.get(need) || 0;
      res += c;
      const delta = x >= 0 ? `+${x}` : `${x}`;
      snap(
        "先查",
        `加上 ${x}，前缀和变成 ${pre}。需要找之前等于 ${pre} − ${k} = <b>${need}</b> 的前缀和，` + (c ? `有 ${c} 个，说明有 ${c} 段以这里结尾的子数组和为 ${k}，答案加 ${c}。` : "没有。"),
        view(i, {
          curPreIdx: i + 1,
          hitKey: c ? need : undefined,
          feeds: [{ from: i, to: i + 1, win: true, label: delta }],
        }),
        {
          at: "query",
          kind: c ? "ok" : "",
          facts: [
            ["k", k],
            ["前缀和", pre, oldPre],
            ["查找 pre−k", need],
            c ? ["答案", res, oldRes] : ["答案", res],
          ],
        },
      );
      const oldCnt = count.get(pre) || 0;
      count.set(pre, oldCnt + 1);
      snap("再存", `把当前前缀和 ${pre} 的出现次数加 1（${oldCnt} → ${oldCnt + 1}）。`, view(i, { curPreIdx: i + 1, storedKey: pre }), {
        at: "store",
        facts: [["k", k], ["前缀和", pre], [`count[${pre}]`, oldCnt + 1, oldCnt], ["答案", res]],
      });
    });
    snap("完成", `一共有 <b>${res}</b> 段子数组的和等于 ${k}。`, view(n), {
      at: "done",
      kind: "ok",
      ans: res,
      facts: [["k", k], ["最终前缀和", pre], ["答案", res]],
    });
  },
  points: [
    { t: "别忘了 count[0] = 1", body: "没有它，从下标 0 开始的子数组（前缀本身等于 k）会被漏掉。" },
    { t: "先查再存", body: "先存再查的话，k = 0 时会把「空子数组」也算进去。" },
    { t: "为什么不能用滑动窗口", body: "数组里有负数，窗口变长时和不一定变大，滑动窗口的单调性不成立。" },
  ],
};
