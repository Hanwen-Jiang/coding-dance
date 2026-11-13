module.exports = {
  id: 295, name: "数据流的中位数", title: "数据流的中位数图解", level: "困难", topic: "堆",
  h1: "数据流的中位数，两个堆各管一半",
  lede: "把数分成较小的一半和较大的一半。较小的一半放进大顶堆，堆顶是这一半里最大的；较大的一半放进小顶堆，堆顶是这一半里最小的。两个堆顶正好夹住中间，中位数只看堆顶就行。",
  hints: [
    { t: "中位数只关心中间", body: ["排好序后，中位数只和中间一两个数有关。没必要让整个序列保持有序。"] },
    { t: "两个堆", body: ["<code>lo</code>：大顶堆，放较小的一半。<code>hi</code>：小顶堆，放较大的一半。", "保持 <code>len(lo) == len(hi)</code> 或 <code>len(lo) == len(hi) + 1</code>。总数是奇数时中位数是 lo 的堆顶，偶数时是两个堆顶的平均值。"] },
    { t: "加入一个数", body: ["先放进 lo，再把 lo 的堆顶挪到 hi，保证 lo 里的每个数都不大于 hi 里的。", "如果这时 hi 比 lo 多，再把 hi 的堆顶挪回 lo。", "Python 的 heapq 只有小顶堆，大顶堆就存相反数。"] },
  ],
  codes: [{ t: "标准解法：大顶堆 + 小顶堆", code: `
class MedianFinder:
    def __init__(self):
        self.lo = []                        # 大顶堆（存相反数），较小的一半
        self.hi = []                        # 小顶堆，较大的一半

    def addNum(self, num: int) -> None:
        heapq.heappush(self.lo, -num)
        heapq.heappush(self.hi, -heapq.heappop(self.lo))    # lo 的最大值挪到 hi
        if len(self.hi) > len(self.lo):                     # 保持 lo 不比 hi 少
            heapq.heappush(self.lo, -heapq.heappop(self.hi))

    def findMedian(self) -> float:
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (-self.lo[0] + self.hi[0]) / 2
` }, { t: "简洁写法：heappushpop", kind: "elegant", note: "heappushpop 先压入再弹出最小值，一步完成「过一遍另一个堆」。两个堆一样多时新数最终进 lo，否则进 hi。", code: `
class MedianFinder:
    def __init__(self):
        self.lo, self.hi = [], []

    def addNum(self, num: int) -> None:
        if len(self.lo) == len(self.hi):
            heapq.heappush(self.lo, -heapq.heappushpop(self.hi, num))
        else:
            heapq.heappush(self.hi, -heapq.heappushpop(self.lo, -num))

    def findMedian(self) -> float:
        if len(self.lo) > len(self.hi):
            return -self.lo[0]
        return (self.hi[0] - self.lo[0]) / 2
` }],
  pytest: `
m = MedianFinder()
m.addNum(1); m.addNum(2)
assert m.findMedian() == 1.5
m.addNum(3)
assert m.findMedian() == 2
m = MedianFinder()
data = [5, 15, 1, 3, 8, 7, 9, 10, 20, 2]
for i, x in enumerate(data):
    m.addNum(x)
    a = sorted(data[:i + 1]); n = len(a)
    assert m.findMedian() == (a[n // 2] if n % 2 else (a[n // 2 - 1] + a[n // 2]) / 2)
`,
  legend: [["a", "正在执行的操作"], ["c", "堆顶"]],
  presets: [
    { label: "示例", args: { ops: [["add", 1], ["add", 2], ["find"], ["add", 3], ["find"]] }, note: "addNum(1) addNum(2) findMedian() addNum(3) findMedian()", expect: [null, null, 1.5, null, 2] },
    { label: "乱序", args: { ops: [["add", 5], ["find"], ["add", 15], ["find"], ["add", 1], ["find"], ["add", 3], ["find"]] }, note: "依次加入 5, 15, 1, 3，每次后查一次中位数", expect: [null, 5, null, 10, null, 5, null, 4] },
  ],
  build(a, snap) {
    const ops = a.ops, lo = [], hi = [], out = [];
    const name = (o) => (o[0] === "add" ? `addNum(${o[1]})` : "findMedian()");
    const view = (i) => [
      { t: "chips", label: "操作", items: ops.map((o, t) => ({ v: name(o), cls: t === i ? "a" : t < i ? "d" : "" })) },
      { t: "array", label: "lo：较小的一半（大顶堆，右边是堆顶）", items: lo.length ? lo.map((v, k) => ({ v, cls: k === lo.length - 1 ? "c" : "" })) : [{ v: "", cls: "d" }], idx: false },
      { t: "array", label: "hi：较大的一半（小顶堆，左边是堆顶）", items: hi.length ? hi.map((v, k) => ({ v, cls: k === 0 ? "c" : "" })) : [{ v: "", cls: "d" }], idx: false },
      { t: "chips", label: "输出", items: out.map((v) => (v === null ? "null" : v)), empty: "还没有" },
    ];
    const ins = (arr, x) => { arr.push(x); arr.sort((p, q) => p - q); };
    snap("开始", "两个堆都是空的。", view(-1), { facts: [["lo", 0], ["hi", 0]] });
    ops.forEach((o, i) => {
      let msg;
      if (o[0] === "add") {
        const x = o[1]; ins(lo, x); const m1 = lo.pop(); ins(hi, m1);
        msg = `先把 ${x} 放进 lo，再把 lo 里最大的 ${m1} 挪到 hi。`;
        if (hi.length > lo.length) { const m2 = hi.shift(); ins(lo, m2); msg += `hi 比 lo 多了，把 hi 里最小的 ${m2} 挪回 lo。`; }
        out.push(null);
      } else {
        const med = lo.length > hi.length ? lo[lo.length - 1] : (lo[lo.length - 1] + hi[0]) / 2;
        out.push(med);
        msg = lo.length > hi.length ? `一共 ${lo.length + hi.length} 个数，是奇数，中位数是 lo 的堆顶 <b>${med}</b>。` : `一共 ${lo.length + hi.length} 个数，是偶数，中位数是两个堆顶的平均 (${lo[lo.length - 1]} + ${hi[0]}) / 2 = <b>${med}</b>。`;
      }
      snap(name(o), msg, view(i), { facts: [["lo", lo.length], ["hi", hi.length]] });
    });
    snap("完成", `输出是 [${out.map((v) => (v === null ? "null" : v)).join(", ")}]。`, view(ops.length), { kind: "ok", ans: out.slice(), facts: [["lo", lo.length], ["hi", hi.length]] });
  },
  points: [
    { t: "先过一遍另一个堆", body: "新数不能直接放进少的那个堆，要先经过另一个堆，才能保证 lo 的最大值 ≤ hi 的最小值。" },
    { t: "相反数", body: "heapq 是小顶堆，lo 里存 -num，取堆顶时再取反。" },
    { t: "复杂度", body: "addNum O(log n)，findMedian O(1)，空间 O(n)。" },
  ],
};
