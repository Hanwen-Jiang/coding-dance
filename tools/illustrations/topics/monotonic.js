module.exports = {
  slug: "monotonic", name: "单调栈与单调队列", kind: "algo", order: 10,
  lede: "单调栈里的元素从栈底到栈顶保持单调。新元素进来前，把破坏单调性的元素都弹掉——被弹掉的那一刻，正好就是它「找到了右边第一个更小（或更大）的元素」。单调队列是两头都能出的单调栈，用来维护滑动窗口的最值。",
  related: [739, 84, 42, 239],
  sections: [{
    key: "stack", t: "单调栈：下一个更小的元素",
    body: [
      "每件商品的折扣是它<b>右边第一个</b>价格不超过它的商品的价格。暴力是对每个 i 往右找，O(n²)。",
      "换个角度：从左往右扫，栈里放「还没找到折扣」的商品下标，它们的价格从栈底到栈顶是<b>递增</b>的。新来一个价格 p，栈顶的商品如果价格 &gt;= p，p 就是它右边第一个不超过它的价格——弹出它、算折扣；一直弹到栈顶比 p 小为止，再把 p 自己压进去。",
      "每个下标进栈、出栈各一次，O(n)。「每日温度」（739）找的是右边第一个更大的，栈就是递减的。",
    ],
    points: [
      { t: "栈里存下标", body: "存下标才知道要更新答案的哪个位置；需要值时用 <code>prices[i]</code> 取。" },
      { t: "最后还在栈里的", body: "扫完以后还在栈里的商品，右边没有更便宜的，没有折扣，答案就是原价。" },
    ],
    codes: [{ t: "递增栈", key: "stack", code: `
class Solution:
    def finalPrices(self, prices: List[int]) -> List[int]:
        ans = prices[:]
        stack = []                              # 还没找到折扣的下标，价格从栈底到栈顶递增 #@init
        for i, p in enumerate(prices):          #@loop
            while stack and prices[stack[-1]] >= p:     # p 是它右边第一个不超过它的价格 #@pop
                ans[stack.pop()] -= p           #@pop
            stack.append(i)                     #@push
        return ans                              #@done
` }],
    sig: { fn: "finalPrices", params: ["int[]"], ret: "int[]" },
    call: (a) => [a.prices],
    cases: [[[8, 4, 6, 2, 3]], [[1, 2, 3, 4, 5]], [[10, 1, 1, 6]], [[5]]],
    gen: (R) => { const prices = R.arr(R.int(4, 9), 1, 10); return { args: { prices }, note: `prices = ${R.fmt(prices)}` }; },
    demo: {
      legend: [["a", "新来的价格"], ["e", "在栈里（还没找到折扣）"], ["c", "已经算好折扣"]],
      presets: [{ label: "示例 1", args: { prices: [8, 4, 6, 2, 3] }, note: "prices = [8,4,6,2,3]", expect: [4, 2, 4, 2, 3] }],
      build(a, snap) {
        const P = a.prices, ans = P.slice(), st = [], done = new Set();
        let cur = -1;
        const view = (hit = -1, opts = {}) => {
          const prevMap = opts.prevMap || {};
          return [
            {
              t: "bars",
              label: "prices",
              items: P.map((v, i) => ({ v, cls: i === cur ? "a" : i === hit ? "c" : st.includes(i) ? "e" : done.has(i) ? "c" : "" })),
              ptrs: { ...(cur >= 0 ? { i: cur } : {}), ...(hit >= 0 ? { j: hit } : {}) },
            },
            {
              t: "chips",
              label: "栈（右边是栈顶，写的是 下标:价格）",
              items: st.map((i, idx) => ({ v: `${i}:${P[i]}`, cls: opts.hlTop && idx === st.length - 1 ? "a" : "e" })),
              empty: "空",
            },
            {
              t: "array",
              label: "ans",
              items: ans.map((v, i) => ({
                v,
                ...(prevMap[i] !== undefined ? { prev: prevMap[i] } : {}),
                cls: i === hit ? "c" : done.has(i) ? "c" : "",
              })),
              ptrs: hit >= 0 ? { 更新: hit } : {},
              feeds: opts.feeds || [],
            },
          ];
        };
        snap("开始", "栈是空的。ans 先复制一份原价。", view(), {
          at: "init",
          facts: [["当前下标 i", "—"], ["栈大小", 0], ["ans", `[${ans.join(", ")}]`]],
        });
        P.forEach((p, i) => {
          cur = i;
          let poppedCount = 0;
          while (st.length && P[st[st.length - 1]] >= p) {
            const prevStLen = st.length;
            const j = st.pop();
            const oldAns = ans[j];
            ans[j] -= p;
            done.add(j);
            poppedCount++;
            snap(
              "弹出折扣",
              `新来价格 ${p}，栈顶 ${j}:${P[j]} 的价格 &gt;= ${p}，${p} 就是它右边第一个不超过它的价格，弹出并更新 ans[${j}] = ${oldAns} - ${p} = <b>${ans[j]}</b>。`,
              view(j, {
                prevMap: { [j]: oldAns },
                feeds: [{ from: i, to: j, win: true, label: `-${p}` }],
              }),
              {
                at: ["loop", "pop"],
                kind: "ok",
                facts: [
                  ["当前下标 i", `${i} (价格 ${p})`],
                  ["弹出下标 j", `${j} (原价 ${P[j]})`],
                  [`ans[${j}]`, ans[j], oldAns],
                  ["栈大小", st.length, prevStLen],
                ],
              },
            );
          }
          const prevStLen = st.length;
          st.push(i);
          snap(
            "压栈",
            `${poppedCount ? "栈顶比 " + p + " 小了，" : `栈顶${st.length > 1 ? "比 " + p + " 小" : "是空的"}，`}把下标 ${i}（价格 ${p}）压进去。栈里的价格仍然递增。`,
            view(-1, { hlTop: true }),
            {
              at: poppedCount ? "push" : ["loop", "pop", "push"],
              facts: [
                ["当前下标 i", `${i} (价格 ${p})`],
                ["压入栈", `${i}:${p}`],
                ["栈大小", st.length, prevStLen],
              ],
            },
          );
        });
        cur = -1;
        snap("完成", st.length ? `栈里剩下的 ${st.map((i) => `${i}:${P[i]}`).join("、")} 右边没有更便宜的，按原价。` : "所有商品都找到了折扣。", view(), {
          at: "done",
          kind: "ok",
          ans: ans.slice(),
          facts: [["商品数", P.length], ["未打折", st.length], ["ans", `[${ans.join(", ")}]`]],
        });
      },
    },
  }, {
    key: "queue", t: "单调队列：滑动窗口的最小值",
    body: [
      "求每个长度为 k 的窗口里的最小值。队列里存下标，对应的值从队头到队尾<b>递增</b>：新来一个数 x，队尾比 x 大的都弹掉——它们比 x 早离开窗口、又比 x 大，以后不可能再是最小值了。",
      "队头的下标如果已经滑出窗口（<code>&lt;= i - k</code>）就从队头弹掉。这样队头永远是当前窗口的最小值。每个下标进出队列各一次，O(n)。",
      "「滑动窗口最大值」（239）把比较方向反过来就行，可以拿这一节的代码去改。",
    ],
    points: [
      { t: "两头都要出", body: "队尾弹「没用的」，队头弹「过期的」，所以要用双端队列：Python <code>deque</code>，Java <code>ArrayDeque</code>，C++ <code>deque</code>。" },
      { t: "窗口满了才记答案", body: "<code>i &gt;= k - 1</code> 时窗口里才有 k 个数。" },
    ],
    codes: [{ t: "递增的双端队列", key: "queue", code: `
class Solution:
    def minSlidingWindow(self, nums: List[int], k: int) -> List[int]:
        q = deque()                             # 存下标，对应的值从队头到队尾递增 #@init
        res = []                                #@init
        for i, x in enumerate(nums):            #@loop
            while q and nums[q[-1]] >= x:       # 比 x 大的以后不可能是最小值了 #@pop
                q.pop()                         #@pop
            q.append(i)                         #@push
            if q[0] <= i - k:                   # 队头滑出了窗口 #@expire
                q.popleft()                     #@expire
            if i >= k - 1:                      # 窗口满了：队头就是最小值 #@record
                res.append(nums[q[0]])          #@record
        return res                              #@done
` }],
    sig: { fn: "minSlidingWindow", params: ["int[]", "int"], ret: "int[]" },
    call: (a) => [a.nums, a.k],
    cases: [[[1, 3, -1, -3, 5, 3, 6, 7], 3], [[1], 1], [[4, 2, 12, 3], 2], [[9, 8, 7, 6], 4]],
    gen: (R) => { const nums = R.arr(R.int(4, 9), 1, 12), k = R.int(1, Math.min(4, nums.length)); return { args: { nums, k }, note: `nums = ${R.fmt(nums)}, k = ${k}` }; },
    demo: {
      legend: [["a", "新来的数"], ["e", "窗口"], ["g", "在队列里"], ["c", "队头：窗口最小值"]],
      presets: [{ label: "示例", args: { nums: [1, 3, -1, -3, 5, 3, 6, 7], k: 3 }, note: "nums = [1,3,-1,-3,5,3,6,7], k = 3", expect: [-1, -3, -3, -3, 3, 3] }],
      build(a, snap) {
        const A = a.nums, k = a.k, q = [], res = [];
        let cur = -1, prevMin = null;
        const view = (opts = {}) => [
          {
            t: "array",
            label: "nums",
            items: A.map((v, i) => ({
              v,
              cls: i === cur ? "a" : i === opts.expired ? "d" : q.length && i === q[0] && cur >= k - 1 ? "c" : q.includes(i) ? "g" : cur >= 0 && i > cur - k && i <= cur ? "e" : "",
            })),
            ptrs: { ...(cur >= 0 ? { i: cur } : {}), ...(q.length ? { 队头: q[0] } : {}) },
            feeds: opts.feeds || [],
          },
          {
            t: "chips",
            label: "队列（左边是队头，写的是 下标:值）",
            items: q.map((i, idx) => ({ v: `${i}:${A[i]}`, cls: idx === 0 && cur >= k - 1 ? "c" : opts.hlTail && idx === q.length - 1 ? "a" : "g" })),
            empty: "空",
          },
          {
            t: "chips",
            label: "res",
            items: res.map((v, idx) => ({ v, cls: opts.newestRes && idx === res.length - 1 ? "c" : "" })),
            empty: "空",
          },
        ];
        snap("开始", `队列是空的，窗口长度 k = ${k}。`, view(), {
          at: "init",
          facts: [["窗口长度 k", k], ["队列大小", 0], ["队头最小值", "—"], ["res 长度", 0]],
        });
        A.forEach((x, i) => {
          cur = i;
          const popped = [];
          const beforePopLen = q.length;
          while (q.length && A[q[q.length - 1]] >= x) popped.push(q.pop());
          if (popped.length) {
            snap(
              "队尾淘汰",
              `新来 nums[${i}] = ${x}。队尾 ${popped.map((j) => `${j}:${A[j]}`).join("、")} 都 &gt;= ${x}，它们比 ${x} 先离开窗口又更大，不可能再是最小值，弹掉。`,
              view({
                feeds: popped.map((j, idx) => ({
                  from: i,
                  to: j,
                  win: idx === 0,
                  ...(idx === 0 ? { label: `淘汰≥${x}` } : {}),
                })),
              }),
              {
                at: ["loop", "pop"],
                facts: [
                  ["当前下标 i", `${i} (值 ${x})`],
                  ["淘汰数量", popped.length],
                  ["队列大小", q.length, beforePopLen],
                ],
              },
            );
          }
          const beforePushLen = q.length;
          q.push(i);
          snap(
            "入队",
            `${popped.length ? "" : `新来 nums[${i}] = ${x}，队尾比它小（或队列空）。`}把下标 ${i} 放到队尾，队列保持递增。`,
            view({ hlTail: true }),
            {
              at: popped.length ? "push" : ["loop", "pop", "push"],
              facts: [
                ["当前下标 i", `${i} (值 ${x})`],
                ["队列大小", q.length, beforePushLen],
                ["队头", `${q[0]}:${A[q[0]]}`],
              ],
            },
          );
          if (q[0] <= i - k) {
            const oldLen = q.length;
            const e = q.shift();
            snap(
              "队头过期",
              `队头下标 ${e}（值 ${A[e]}）已经滑出窗口 [${i - k + 1}, ${i}]，从队头弹掉。`,
              view({ expired: e }),
              {
                at: "expire",
                facts: [
                  ["当前窗口", `[${i - k + 1}, ${i}]`],
                  ["队列大小", q.length, oldLen],
                  ["队头", `${q[0]}:${A[q[0]]}`, `${e}:${A[e]}`],
                ],
              },
            );
          }
          if (i >= k - 1) {
            const oldResLen = res.length;
            const curMin = A[q[0]];
            res.push(curMin);
            snap(
              "记下最小值",
              `窗口 [${i - k + 1}, ${i}] 满了，队头 ${q[0]}:${curMin} 就是当前窗口最小值。`,
              view({
                newestRes: true,
                feeds: q[0] !== i ? [{ from: q[0], to: i, win: true, label: `min=${curMin}` }] : [],
              }),
              {
                at: "record",
                kind: "ok",
                facts: [
                  ["当前窗口", `[${i - k + 1}, ${i}]`],
                  ["窗口最小值", curMin, prevMin ?? undefined],
                  ["res 长度", res.length, oldResLen],
                ],
              },
            );
            prevMin = curMin;
          }
        });
        cur = -1;
        snap("完成", `结果是 [${res.join(", ")}]。`, view(), {
          at: "done",
          kind: "ok",
          ans: res.slice(),
          facts: [["窗口长度 k", k], ["res", `[${res.join(", ")}]`]],
        });
      },
    },
  }],
};
