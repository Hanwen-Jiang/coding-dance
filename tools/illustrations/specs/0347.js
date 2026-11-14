module.exports = {
  id: 347, name: "前 K 个高频元素", title: "前 K 个高频元素图解", level: "中等", topic: "堆",
  h1: "前 K 个高频元素，先计数，再留下最多的 k 个",
  lede: "先用哈希表数出每个数出现了几次。然后用一个大小为 k 的小顶堆：堆顶是堆里出现次数最少的，新来的数次数更多就把堆顶挤掉。最后堆里剩下的就是出现最多的 k 个。",
  hints: [
    { t: "第一步：计数", body: ["<code>Counter(nums)</code> 得到每个数的出现次数。问题变成：在这些（数, 次数）里找次数最大的 k 个。"] },
    { t: "为什么用小顶堆", body: ["堆里只留 k 个。堆顶是其中次数最少的，是「门槛」。", "新来的元素次数比门槛高，就把门槛挤掉。复杂度 <code>O(n log k)</code>，比全排序好。"] },
    { t: "还能更快", body: ["出现次数最多是 n。开 n + 1 个桶，第 c 个桶放出现 c 次的数，从高到低取 k 个，O(n)。"] },
  ],
  codes: [{ t: "标准解法：计数 + 小顶堆", code: `
class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        cnt = Counter(nums)
        heap = []                           # 小顶堆，只留次数最多的 k 个
        for x, c in cnt.items():
            heapq.heappush(heap, (c, x))
            if len(heap) > k:
                heapq.heappop(heap)         # 挤掉次数最少的
        return [x for c, x in heap]
` }, { t: "简洁写法：most_common", kind: "elegant", note: "Counter.most_common(k) 内部就是用堆取前 k 个。", code: `
class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        return [x for x, _ in Counter(nums).most_common(k)]
` }, { t: "O(n) 写法：桶排序", code: `
class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        buckets = [[] for _ in range(len(nums) + 1)]
        for x, c in Counter(nums).items():
            buckets[c].append(x)            # 第 c 个桶放出现 c 次的数
        res = []
        for c in range(len(nums), 0, -1):
            res += buckets[c]
            if len(res) >= k:
                return res[:k]
` }],
  pytest: `
s = Solution()
assert sorted(s.topKFrequent([1,1,1,2,2,3], 2)) == [1,2]
assert s.topKFrequent([1], 1) == [1]
assert sorted(s.topKFrequent([4,1,-1,2,-1,2,3], 2)) == [-1,2]
assert sorted(s.topKFrequent([5,5,6,6,6,7], 1)) == [6]
`,
  method: "计数 + 小顶堆",
  cmp: "unordered",
  legend: [["a", "正在看的数"], ["b", "被挤掉的"], ["c", "堆顶（门槛）"]],
  presets: [
    { label: "示例 1", args: { nums: [1, 1, 1, 2, 2, 3], k: 2 }, note: "nums = [1,1,1,2,2,3], k = 2", expect: [1, 2] },
    { label: "有负数", args: { nums: [4, 1, -1, 2, -1, 2, 3], k: 2 }, note: "nums = [4,1,-1,2,-1,2,3], k = 2", expect: [2, -1] },
  ],
  build(a, snap) {
    const { nums, k } = a, cnt = new Map();
    for (const x of nums) cnt.set(x, (cnt.get(x) || 0) + 1);
    const ents = [...cnt], heap = [];
    const cmp = (p, q) => p[0] - q[0] || p[1] - q[1];
    const view = (cur, out) => [
      { t: "chips", label: "计数（数 × 次数）", items: ents.map(([x, c]) => ({ v: `${x} × ${c}`, cls: x === cur ? "a" : "" })) },
      { t: "array", label: `小顶堆（按次数从小到大排，最左边是堆顶，最多 ${k} 个）`, items: heap.length ? heap.map(([c, x], i) => ({ v: `${x}(${c}次)`, cls: i === 0 ? "c" : "" })) : [{ v: "", cls: "d" }], idx: false },
      { t: "chips", label: "挤掉的", items: out.map(([c, x]) => ({ v: `${x}(${c}次)`, cls: "b" })), empty: "还没有" },
    ];
    snap("计数", `先数一遍：${ents.map(([x, c]) => `${x} 出现 ${c} 次`).join("，")}。`, view(null, []));
    const outs = [];
    for (const [x, c] of ents) {
      heap.push([c, x]); heap.sort(cmp);
      if (heap.length > k) { const o = heap.shift(); outs.push(o); snap("挤掉", `放入 ${x}（${c} 次）后堆里超过 ${k} 个，弹出堆顶 ${o[1]}（${o[0]} 次），它是次数最少的。`, view(x, outs), { kind: "warn" }); }
      else snap("入堆", `放入 ${x}（${c} 次）。堆里还不到 ${k + 1} 个，不用挤。`, view(x, outs));
    }
    const ans = heap.slice().reverse().map(([, x]) => x);
    snap("完成", `堆里剩下的就是出现最多的 ${k} 个：[${ans.join(",")}]。`, view(null, outs), { kind: "ok", ans });
  },
  alts: [{
    t: "桶排序",
    note: "和 O(n) 写法一样：出现次数不会超过 n，所以开 n + 1 个桶，第 c 个桶放出现 c 次的数。再从次数最大的桶往回取，取够 k 个就停。",
    legend: [["a", "正在处理"], ["c", "已经取进结果"], ["d", "第 0 个桶用不到"]],
    build(a, snap) {
      const { nums, k } = a, n = nums.length, cnt = new Map();
      for (const x of nums) cnt.set(x, (cnt.get(x) || 0) + 1);
      const ents = [...cnt], B = Array.from({ length: n + 1 }, () => []), res = [];
      let cur = -1, low = n + 1;
      const view = (x) => [
        { t: "chips", label: "计数（数 × 次数）", items: ents.map(([v, c]) => ({ v: `${v} × ${c}`, cls: v === x ? "a" : "" })) },
        { t: "array", label: "buckets[c]：出现 c 次的数", items: B.map((b, c) => ({ v: b.join(","), cls: c === cur ? "a" : c >= low && b.length ? "c" : c === 0 ? "d" : "" })) },
        { t: "chips", label: "结果", items: res.map((v) => ({ v, cls: "c" })), empty: "还没有" },
      ];
      snap("计数", `先数一遍：${ents.map(([x, c]) => `${x} 出现 ${c} 次`).join("，")}。`, view(null));
      for (const [x, c] of ents) { B[c].push(x); cur = c; snap("放进桶", `${x} 出现 ${c} 次，放进第 ${c} 个桶。`, view(x)); }
      cur = -1;
      snap("从后往前取", `次数越大越靠后。从第 ${n} 个桶往回扫，空桶直接跳过。`, view(null));
      for (let c = n; c >= 1; c--) {
        if (!B[c].length) continue;
        cur = c; low = c; res.push(...B[c]);
        const enough = res.length >= k;
        snap("取出", `第 ${c} 个桶里有 ${B[c].join("、")}（各出现 ${c} 次），放进结果。` + (enough ? `已经有 ${res.length} 个，够 k = ${k} 个了。` : `还不够 ${k} 个，继续往回扫。`), view(null));
        if (enough) break;
      }
      const ans = res.slice(0, k);
      cur = -1;
      snap("完成", `前 ${k} 个高频元素是 [${ans.join(",")}]。`, view(null), { kind: "ok", ans });
    },
  }],
  points: [
    { t: "堆里放 (次数, 数)", body: "元组按第一项比较，次数放前面。次数相同时会比较第二项，数是整数，不会报错。" },
    { t: "小顶堆而不是大顶堆", body: "大顶堆要把所有元素都放进去再弹 k 次，O(n log n)；小顶堆只留 k 个，O(n log k)。" },
    { t: "复杂度", body: "计数 O(n)，堆 O(m log k)，m 是不同数的个数。桶排序 O(n)。" },
  ],
};
