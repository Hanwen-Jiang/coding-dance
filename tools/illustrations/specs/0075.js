module.exports = {
  id: 75, name: "颜色分类", title: "颜色分类图解", level: "中等", topic: "技巧",
  h1: "颜色分类，三个指针分出三块",
  lede: "荷兰国旗问题。用三个指针把数组分成四段：左边是 0，接着是 1，中间是还没看的，右边是 2。i 扫描中间段：0 换到左边，2 换到右边，1 留在原地。一遍就排好。",
  hints: [
    { t: "只有三种值", body: ["可以数一遍 0、1、2 各有几个，再按个数写回去。但题目希望一遍扫描、原地完成。"] },
    { t: "维护四个区间", body: ["<code>[0, lo)</code> 全是 0，<code>[lo, i)</code> 全是 1，<code>[i, hi]</code> 还没看，<code>(hi, n)</code> 全是 2。"] },
    { t: "看 nums[i]", body: ["是 0：和 <code>nums[lo]</code> 交换，<code>lo</code>、<code>i</code> 都前进。换过来的一定是 1（或者 i == lo），已经看过。", "是 2：和 <code>nums[hi]</code> 交换，<code>hi</code> 后退，<strong>i 不动</strong>，因为换过来的数还没看过。", "是 1：<code>i</code> 前进。"] },
  ],
  codes: [{ t: "标准解法：三指针（荷兰国旗）", code: `
class Solution:
    def sortColors(self, nums: List[int]) -> None:
        lo, i, hi = 0, 0, len(nums) - 1     # [0,lo) 是 0，[lo,i) 是 1，(hi,end] 是 2 #@init
        while i <= hi:                      #@loop
            if nums[i] == 0:                #@chk0
                nums[lo], nums[i] = nums[i], nums[lo]   #@swap0
                lo += 1                     #@adv0
                i += 1                      #@adv0
            elif nums[i] == 2:              #@chk2
                nums[i], nums[hi] = nums[hi], nums[i]   #@swap2
                hi -= 1                     # 换过来的数还没看过，i 不动 #@adv2
            else:                           #@one
                i += 1                      #@one
` }, { t: "简洁写法：先写 2，再覆盖成 1 和 0", key: "paint", kind: "elegant", note: "每个位置先写成 2；读到的是 0 或 1，就把 1 的区域往后扩一格；读到的是 0，再把 0 的区域往后扩一格。后写的覆盖先写的。", code: `
class Solution:
    def sortColors(self, nums: List[int]) -> None:
        p0 = p1 = 0                         # 下一个 0、下一个 1 该写的位置 #@init
        for i, x in enumerate(nums):        #@read
            nums[i] = 2                     #@read
            if x < 2:                       #@one
                nums[p1] = 1                #@one
                p1 += 1                     #@one
            if x == 0:                      #@zero
                nums[p0] = 0                #@zero
                p0 += 1                     #@zero
` }],
  sig: { fn: "sortColors", params: ["int[]"], ret: "void" },
  call: (a) => [a.nums],
  cases: [[[0]], [[2]], [[1, 0]], [[2, 2, 0, 0, 1, 1]]],
  pytest: `
s = Solution()
def f(a):
    s.sortColors(a); return a
assert f([2,0,2,1,1,0]) == [0,0,1,1,2,2]
assert f([2,0,1]) == [0,1,2]
assert f([0]) == [0]
assert f([1,2,0,0,2,1,1]) == [0,0,1,1,1,2,2]
for _ in range(30):
    a = [random.randint(0, 2) for _ in range(random.randint(1, 15))]
    assert f(a[:]) == sorted(a)
`,
  method: "三指针交换",
  legend: [["e", "确定是 0"], ["g", "确定是 1"], ["w", "确定是 2"], ["a", "当前位置 i / 刚换完"]],
  presets: [
    { label: "示例 1", args: { nums: [2, 0, 2, 1, 1, 0] }, note: "nums = [2,0,2,1,1,0]", expect: [0, 0, 1, 1, 2, 2] },
    { label: "示例 2", args: { nums: [2, 0, 1] }, note: "nums = [2,0,1]", expect: [0, 1, 2] },
  ],
  build(a, snap) {
    const nums = a.nums.slice();
    let lo = 0, i = 0, hi = nums.length - 1;
    const view = (opts = {}) => {
      const prevMap = opts.prevMap || {};
      return [{
        t: "array",
        label: "nums（[0,lo) 全是 0，[lo,i) 全是 1，(hi,end] 全是 2）",
        items: nums.map((v, k) => ({
          v,
          ...(prevMap[k] !== undefined ? { prev: prevMap[k] } : {}),
          cls: k < lo ? "e" : k < i ? "g" : k > hi ? "w" : k === i ? "a" : "",
        })),
        ptrs: { lo, i: i <= hi ? i : null, hi },
        ...(opts.swaps ? { swaps: opts.swaps } : {}),
      }];
    };
    snap("初始化", "lo 和 i 从 0 开始，hi 在末尾。一开始所有元素都在未处理区间 [i, hi] 内。", view(), { at: "init", facts: [["lo", lo], ["i", i], ["hi", hi]] });

    while (i <= hi) {
      const x = nums[i];
      if (x === 0) {
        snap("判断 nums[i] == 0", `nums[${i}] = 0，应该放到左边 0 的区间末尾（lo = ${lo}）。`, view(), { at: "chk0", facts: [["lo", lo], ["i", i], ["hi", hi]] });
        const oldLo = nums[lo], oldI = nums[i];
        [nums[lo], nums[i]] = [nums[i], nums[lo]];
        snap(
          "交换 nums[lo] 与 nums[i]",
          lo === i
            ? `lo 和 i 在同一个位置 ${i}，0 留在原地。`
            : `把 nums[${i}]（${oldI}）与 nums[${lo}]（${oldLo}）交换，0 来到下标 ${lo}。`,
          view({
            swaps: lo !== i ? [[lo, i]] : [],
            prevMap: lo !== i ? { [lo]: oldLo, [i]: oldI } : {},
          }),
          { at: "swap0", facts: [["lo", lo], ["i", i], ["hi", hi]] },
        );
        const pLo = lo, pI = i;
        lo++; i++;
        snap("lo 和 i 前进", `0 的区间扩大到 [0, ${lo})，而且换过来的 ${nums[pI] ?? "数"} 一定已经看过（1 或它自己），所以 lo 和 i 一起前进。`, view(), { at: "adv0", facts: [["lo", lo, pLo], ["i", i, pI], ["hi", hi]] });
      } else if (x === 2) {
        snap("判断 nums[i] == 2", `nums[${i}] = 2，应该换到右边 2 的区间开头（hi = ${hi}）。`, view(), { at: "chk2", facts: [["lo", lo], ["i", i], ["hi", hi]] });
        const oldI = nums[i], oldHi = nums[hi];
        [nums[i], nums[hi]] = [nums[hi], nums[i]];
        snap(
          "交换 nums[i] 与 nums[hi]",
          i === hi
            ? `i 和 hi 在同一个位置 ${i}，2 已经在右边了。`
            : `把 nums[${i}]（${oldI}）与 nums[${hi}]（${oldHi}）交换，2 换到下标 ${hi}；原来的 ${oldHi} 换到了下标 ${i}。`,
          view({
            swaps: i !== hi ? [[i, hi]] : [],
            prevMap: i !== hi ? { [i]: oldI, [hi]: oldHi } : {},
          }),
          { at: "swap2", facts: [["lo", lo], ["i", i], ["hi", hi]] },
        );
        const pHi = hi;
        hi--;
        snap("hi 后退，i 不动", `2 的区间向左扩到 (${hi}, ${nums.length})。注意 <b>i 留在 ${i} 不动</b>：刚从 hi 换过来的 ${nums[i]} 还没检查过！`, view(), { at: "adv2", facts: [["lo", lo], ["i", i], ["hi", hi, pHi]] });
      } else {
        const pI = i;
        i++;
        snap("nums[i] == 1，i 前进", `nums[${pI}] = 1 正好属于中间的 1 区间，不用交换，直接 i 前进到 ${i}。`, view(), { at: "one", facts: [["lo", lo], ["i", i, pI], ["hi", hi]] });
      }
    }
    snap("完成", `i (${i}) 超过了 hi (${hi})，未处理区间为空。结果 [${nums.join(", ")}]。`, view(), { at: "loop", kind: "ok", ans: nums.slice(), facts: [["lo", lo], ["i", i], ["hi", hi]] });
  },
  alts: [{
    t: "先写 2 再覆盖",
    code: "paint",
    note: "和简洁写法一样：每读一个数 x = nums[i]，分三步覆盖刷色：先把当前格写成 2；若 x < 2，就在 p1 处写 1 并让 p1++；若 x == 0，就在 p0 处写 0 并让 p0++。",
    legend: [["e", "0"], ["g", "1"], ["w", "2"], ["a", "这一步正在改写的格子"]],
    build(a, snap) {
      const nums = a.nums.slice(), n = nums.length;
      let p0 = 0, p1 = 0;
      const col = { 0: "e", 1: "g", 2: "w" };
      const view = (i, wr, prevMap = {}) => [{
        t: "array",
        label: "nums（[0,p0) 是 0，[p0,p1) 是 1，[p1,i] 是 2）",
        items: nums.map((v, k) => ({
          v,
          ...(prevMap[k] !== undefined ? { prev: prevMap[k] } : {}),
          cls: wr.has(k) ? "a" : k <= i ? col[v] : "",
        })),
        ptrs: { p0, p1, i: i >= 0 && i < n ? i : null },
      }];
      const f = (at, x, prevP0, prevP1) => ({
        at,
        facts: [
          ...(x !== undefined ? [["读出 x", x]] : []),
          ["p0 (0 的个数)", p0, prevP0],
          ["p1 (≤1 的个数)", p1, prevP1],
        ],
      });
      snap("初始化", "p0 是下一个 0 该写的位置，p1 是下一个 1 该写的位置。从左到右刷过去，后写的覆盖先写的。", view(-1, new Set()), f("init"));
      for (let i = 0; i < n; i++) {
        const x = nums[i];
        nums[i] = 2;
        snap(`读出 x=${x}，先写 2`, `先记住 nums[${i}] 原来的值 x = <b>${x}</b>，把 nums[${i}] 先覆盖写成 2。`, view(i, new Set([i]), { [i]: x }), f("read", x));
        if (x < 2) {
          const old1 = nums[p1];
          const oldP1 = p1;
          nums[p1] = 1;
          p1++;
          snap("写入 1 并扩大 1 区间", `因为 x = ${x} < 2，在 p1 = ${oldP1} 处写入 <b>1</b>，然后 p1 右移到 ${p1}。`, view(i, new Set([oldP1]), { [oldP1]: old1 }), f("one", x, undefined, oldP1));
        }
        if (x === 0) {
          const old0 = nums[p0];
          const oldP0 = p0;
          nums[p0] = 0;
          p0++;
          snap("写入 0 并扩大 0 区间", `因为 x = 0，在 p0 = ${oldP0} 处写入 <b>0</b>（覆盖掉刚才的 1 或 2），然后 p0 右移到 ${p0}。`, view(i, new Set([oldP0]), { [oldP0]: old0 }), f("zero", x, oldP0));
        }
      }
      snap("完成", `全部扫描完成，结果 [${nums.join(", ")}]。`, view(n, new Set()), { kind: "ok", ans: nums.slice(), ...f([]) });
    },
  }],
  points: [
    { t: "换 2 时 i 不前进", body: "从右边换过来的数可能是 0、1、2 中任意一个，必须再判断一次。" },
    { t: "循环条件是 i <= hi", body: "hi 指向的位置还没看过，要包含在内。" },
    { t: "复杂度", body: "一遍扫描，时间 O(n)，空间 O(1)。" },
  ],
};
