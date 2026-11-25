module.exports = {
  id: 128, name: "最长连续序列", title: "最长连续序列图解", level: "中等", topic: "哈希",
  h1: "最长连续序列，只从起点开始数",
  lede: "题目要求 O(n)，所以不能排序。把所有数放进集合后，只从每段连续序列的起点开始往上数，每个数就只会被数到一次。",
  hints: [
    { t: "先让查找变快", body: ["把所有数放进集合（<code>set</code>），之后问「x 在不在」就是 <code>O(1)</code>。", "集合还顺手去了重。"] },
    { t: "从哪个数开始数", body: ["对每个数都往上数 <code>x+1, x+2, …</code> 会重复：从 1 数了 1,2,3,4，从 2 又数一遍 2,3,4。", "只从<strong>起点</strong>开始数。<code>x</code> 是起点的条件是 <code>x - 1</code> 不在集合里。"] },
    { t: "为什么是 O(n)", body: ["看起来有两层循环，但内层的 <code>while</code> 只在起点上跑，每个数最多被某一个起点数到一次，总共 <code>O(n)</code>。"] },
  ],
  codes: [{ t: "标准解法：集合 + 只从起点数", code: `
class Solution:
    def longestConsecutive(self, nums: List[int]) -> int:
        s = set(nums)                   #@init
        best = 0                        #@init
        for x in s:                     # 遍历集合，不是遍历 nums
            if x - 1 in s:              #@skip
                continue                # 不是起点，跳过 #@skip
            y = x                       #@start
            while y + 1 in s:           #@count
                y += 1                  #@count
            best = max(best, y - x + 1) #@best
        return best                     #@done
` }, { t: "简洁写法：只更新段的两个端点", key: "ends", kind: "elegant", note: "lens[x] 记 x 所在连续段的长度，但只保证段的两个端点是准的。新来的 x 把左右两段连起来，更新新段的两个端点即可。", code: `
class Solution:
    def longestConsecutive(self, nums: List[int]) -> int:
        lens, best = {}, 0              #@init
        for x in nums:
            if x not in lens:           #@dup
                l, r = lens.get(x - 1, 0), lens.get(x + 1, 0)   #@join
                lens[x] = lens[x - l] = lens[x + r] = l + r + 1 #@join
                best = max(best, l + r + 1)                     #@join
        return best                     #@done
` }],
  pytest: `
s = Solution()
assert s.longestConsecutive([100,4,200,1,3,2]) == 4
assert s.longestConsecutive([0,3,7,2,5,8,4,6,0,1]) == 9
assert s.longestConsecutive([]) == 0
assert s.longestConsecutive([1,0,1,2]) == 3
`,
  sig: { fn: "longestConsecutive", params: ["int[]"], ret: "int" },
  call: (a) => [a.nums],
  cases: [[[]], [[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], [[1, 0, 1, 2]], [[-1000000000, 1000000000, 0, -1]], [[5, 5, 5]]],
  method: "只从起点数",
  legend: [["a", "当前起点 / 正在延伸"], ["b", "x − 1（前驱存在）"], ["w", "不是起点，跳过"], ["e", "当前连续段"], ["c", "最长的一段"]],
  presets: [
    { label: "示例 1", args: { nums: [100, 4, 200, 1, 3, 2] }, note: "nums = [100,4,200,1,3,2]", expect: 4 },
    { label: "有重复", args: { nums: [9, 1, 4, 7, 3, 2, 8, 1, 6] }, note: "nums = [9,1,4,7,3,2,8,1,6]", expect: 4 },
  ],
  build(a, snap) {
    const set = [...new Set(a.nums)], has = new Set(set);
    let best = 0, bestRun = [];
    const view = (cur, run, opts = {}) => [
      {
        t: "chips",
        label: "集合 s（已去重）",
        items: set.map((v) => ({
          v,
          cls: opts.done
            ? (bestRun.includes(v) ? "c" : "")
            : opts.skip && v === cur
              ? "w"
              : opts.skip && v === opts.blocker
                ? "b"
                : opts.head !== undefined && v === opts.head
                  ? "a"
                  : run && run.includes(v)
                    ? "e"
                    : v === cur
                      ? "a"
                      : "",
        })),
        empty: "空",
      },
      {
        t: "chips",
        label: opts.done ? "最长连续段" : "当前连续段",
        items: (opts.done ? bestRun : run || []).map((v, idx, arr) => ({
          v,
          cls: opts.done ? "c" : idx === arr.length - 1 && opts.head !== undefined ? "a" : "e",
        })),
        empty: "空",
      },
    ];
    let prevCur = "—", prevLen = 0;
    snap("建集合", `把 nums 里的数放进集合去重，共 ${set.length} 个。只从没有前驱（x − 1 不在集合）的起点开始数。`, view(null, null), {
      at: "init",
      facts: [["当前 x", "—"], ["当前长度", 0], ["最长", 0]],
    });
    for (const x of set) {
      if (has.has(x - 1)) {
        snap("跳过非起点", `${x}：前驱 ${x - 1} 在集合里，说明 ${x} 不是起点，会被前面的起点数到，<b>跳过</b>。`, view(x, null, { skip: true, blocker: x - 1 }), {
          at: "skip",
          kind: "warn",
          facts: [["当前 x", x, prevCur], ["当前长度", 0, prevLen], ["最长", best]],
        });
        prevCur = x; prevLen = 0;
        continue;
      }
      const run = [x];
      snap("找到起点", `${x}：${x - 1} 不在集合里，${x} 是起点，从这里往上数。`, view(x, run, { head: x }), {
        at: "start",
        facts: [["当前 x", x, prevCur], ["当前长度", 1, prevLen], ["最长", best]],
      });
      prevCur = x; prevLen = 1;
      let y = x;
      while (has.has(y + 1)) {
        y++; run.push(y);
        snap("往上数", `${y} 在集合里，接上。当前连续段是 ${x} 到 ${y}，长度 <b>${run.length}</b>。`, view(x, run, { head: y }), {
          at: "count",
          facts: [["当前 x", x], ["当前长度", run.length, prevLen], ["最长", best]],
        });
        prevLen = run.length;
      }
      const oldBest = best, improved = run.length > best;
      if (improved) { best = run.length; bestRun = run.slice(); }
      snap("这段结束", `${y + 1} 不在集合里，这段到此为止，长度 ${run.length}。` + (improved ? `更新最长为 <b>${best}</b>。` : `没有超过当前最长 ${best}。`), view(null, run), {
        at: "best",
        facts: [["当前 x", x], ["当前长度", run.length], ["最长", best, oldBest]],
      });
    }
    snap("完成", best ? `所有数都看过了，最长连续序列的长度是 <b>${best}</b>（${bestRun[0]} 到 ${bestRun[bestRun.length - 1]}）。` : `集合为空，最长连续序列的长度是 <b>0</b>。`, view(null, null, { done: true }), {
      at: "done",
      kind: "ok",
      ans: best,
      facts: [["当前 x", "—", prevCur], ["当前长度", 0, prevLen], ["最长", best]],
    });
  },
  alts: [{
    t: "更新两个端点",
    code: "ends",
    note: "和简洁写法一样：lens[x] 记 x 所在连续段的长度，但只保证每段的两个端点是准的。新来的 x 把左边以 x−1 结尾的段和右边以 x+1 开头的段连起来，只更新新段的两个端点。",
    legend: [["a", "当前的数"], ["e", "查到的左右邻居"], ["c", "更新后的端点"], ["d", "已经处理"], ["w", "重复，跳过"]],
    build(a, snap) {
      const nums = a.nums, lens = new Map(); let best = 0;
      const view = (i, opts = {}) => {
        const lookup = new Set(opts.lookup || []), upd = new Set(opts.upd || []);
        return [
          {
            t: "array",
            label: "nums",
            items: nums.map((v, t) => ({ v, cls: t === i ? (opts.dup ? "w" : "a") : t < i ? "d" : "" })),
            ptrs: { i: i >= 0 && i < nums.length ? i : null },
          },
          {
            t: "chips",
            label: "lens（数 → 所在段的长度，只有端点是准的）",
            items: [...lens.keys()].sort((p, q) => p - q).map((x) => ({
              v: `${x} → ${lens.get(x)}`,
              cls: x === opts.dupVal ? "w" : upd.has(x) ? "c" : lookup.has(x) ? "e" : "",
            })),
            empty: "空",
          },
        ];
      };
      let prevX = "—", prevLen = "—";
      snap("开始", "lens 一开始是空的。逐个处理 nums 里的数。", view(-1), {
        at: "init",
        facts: [["当前 x", "—"], ["新段长度", "—"], ["最长", 0]],
      });
      nums.forEach((x, i) => {
        if (lens.has(x)) {
          snap("重复跳过", `${x} 已经在 lens 里了，跳过不重复处理。`, view(i, { dup: true, dupVal: x }), {
            at: "dup",
            kind: "warn",
            facts: [["当前 x", x, prevX], ["新段长度", "—", prevLen], ["最长", best]],
          });
          prevX = x; prevLen = "—";
          return;
        }
        const l = lens.get(x - 1) || 0, r = lens.get(x + 1) || 0, len = l + r + 1;
        const lookup = [];
        if (l > 0) lookup.push(x - 1);
        if (r > 0) lookup.push(x + 1);
        const expr = `${l}+${r}+1=${len}`;
        snap(
          "查左右邻居",
          `${x}：左邻居 ${x - 1}${l ? ` 在表里（长 ${l}）` : " 不在（长 0）"}，右邻居 ${x + 1}${r ? ` 在表里（长 ${r}）` : " 不在（长 0）"}。`,
          view(i, { lookup }),
          {
            at: "join",
            facts: [["当前 x", x, prevX], ["新段长度", expr, prevLen], ["最长", best]],
          },
        );
        const oldBest = best;
        lens.set(x, len); lens.set(x - l, len); lens.set(x + r, len);
        best = Math.max(best, len);
        snap(
          "合并并更新端点",
          `连成新段 [${x - l}…${x + r}]，长度 <b>${len}</b>。把 ${x} 和两个端点 ${x - l}、${x + r} 都更新成 ${len}。`,
          view(i, { upd: [x, x - l, x + r] }),
          {
            at: "join",
            facts: [["当前 x", x], ["新段长度", len, expr], ["最长", best, oldBest]],
          },
        );
        prevX = x; prevLen = len;
      });
      snap("完成", `全部处理完，最长连续序列的长度是 <b>${best}</b>。每个数只处理一次，时间 O(n)。`, view(nums.length), {
        at: "done",
        kind: "ok",
        ans: best,
        facts: [["当前 x", "—", prevX], ["新段长度", "—", prevLen], ["最长", best]],
      });
    },
  }],
  points: [
    { t: "遍历集合，不要遍历 nums", body: "nums 里有大量重复的起点时，遍历 nums 会让同一段被反复数，力扣有专门卡这一点的用例。" },
    { t: "起点判断是关键", body: "少了 <code>if x - 1 in s</code> 这一行，结果仍然对，但会退化成 O(n²)。" },
    { t: "空数组", body: "<code>best</code> 初始为 0，空数组不进循环，直接返回 0。" },
  ],
};
