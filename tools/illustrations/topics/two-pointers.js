module.exports = {
  slug: "two-pointers", name: "双指针", kind: "algo", order: 8,
  lede: "用两个下标一起扫数组，每一步根据当前的情况决定动哪一个，把 O(n²) 的两层循环变成 O(n) 的一趟。常见两种：一头一尾往中间走（相向），一快一慢同方向走（同向）。",
  related: [283, 11, 15, 42, 141, 142, 19, 75],
  sections: [{
    key: "opposite", t: "相向双指针：有序数组的两数之和",
    body: [
      "数组有序，<code>l</code> 从最左、<code>r</code> 从最右出发，看两数之和 s：<code>s &lt; target</code> 说明太小，而 <code>numbers[r]</code> 已经是能配的最大的数了，所以 <code>numbers[l]</code> 和谁配都不够，<b>把 l 排除</b>，l 右移；<code>s &gt; target</code> 同理把 r 排除。",
      "每一步排除一个数，最多 n 步就找到答案。「盛最多水的容器」（11）、「三数之和」（15）里的内层循环都是这个思路：每次移动那个「不可能再成为答案」的指针。",
    ],
    points: [
      { t: "下标从 1 开始", body: "这道题要返回的是从 1 开始的下标，所以是 <code>[l + 1, r + 1]</code>。" },
      { t: "为什么不会错过答案", body: "被排除的数和所有还没排除的数都配不上，答案一定还在 <code>[l, r]</code> 里。" },
    ],
    codes: [{ t: "一头一尾", key: "opposite", code: `
class Solution:
    def twoSum(self, numbers: List[int], target: int) -> List[int]:
        l, r = 0, len(numbers) - 1              # 一头一尾 #@init
        while l < r:
            s = numbers[l] + numbers[r]         #@sum
            if s == target:                     #@hit
                return [l + 1, r + 1]           # 题目的下标从 1 开始 #@hit
            if s < target:                      # 太小：numbers[l] 和谁配都不够 #@small
                l += 1                          #@small
            else:                               # 太大：numbers[r] 和谁配都太大 #@big
                r -= 1                          #@big
        return []
` }],
    sig: { fn: "twoSum", params: ["int[]", "int"], ret: "int[]" },
    call: (a) => [a.nums, a.target],
    cases: [[[2, 7, 11, 15], 9], [[2, 3, 4], 6], [[-1, 0], -1], [[1, 2, 3, 4, 4, 9, 56, 90], 8]],
    gen: (R) => {
      for (;;) {
        const nums = R.sorted(R.arr(R.int(4, 9), -5, 20)), i = R.int(0, nums.length - 2), j = R.int(i + 1, nums.length - 1), target = nums[i] + nums[j];
        let pairs = 0;
        for (let x = 0; x < nums.length; x++) for (let y = x + 1; y < nums.length; y++) if (nums[x] + nums[y] === target) pairs++;
        if (pairs === 1) return { args: { nums, target }, note: `numbers = ${R.fmt(nums)}, target = ${target}` };
      }
    },
    demo: {
      legend: [["a", "l / r"], ["d", "已经排除"], ["c", "找到的两个数"]],
      presets: [{ label: "示例", args: { nums: [1, 3, 4, 6, 8, 11, 15], target: 17 }, note: "numbers = [1,3,4,6,8,11,15], target = 17", expect: [4, 6] }],
      build(a, snap) {
        const A = a.nums;
        let l = 0, r = A.length - 1, hit = false, prevSum = "—";
        const view = () => [{
          t: "array",
          label: "numbers",
          items: A.map((v, i) => ({ v, cls: hit && (i === l || i === r) ? "c" : i === l || i === r ? "a" : i < l || i > r ? "d" : "" })),
          ptrs: { l, r },
        }];
        snap("开始", "l 在最左，r 在最右。", view(), {
          at: "init",
          facts: [["target", a.target], ["区间 [l, r]", `[0, ${A.length - 1}]`], ["当前和", "—"]],
        });
        while (l < r) {
          const s = A[l] + A[r];
          const curSum = `${A[l]} + ${A[r]} = ${s}`;
          if (s === a.target) {
            hit = true;
            snap("找到了", `${A[l]} + ${A[r]} = ${s}，正好。返回 [${l + 1}, ${r + 1}]（下标从 1 开始）。`, view(), {
              at: ["sum", "hit"],
              kind: "ok",
              ans: [l + 1, r + 1],
              facts: [["target", a.target], ["当前和", curSum, prevSum], ["返回 (1-based)", `[${l + 1}, ${r + 1}]`]],
            });
            return;
          }
          if (s < a.target) {
            snap("太小", `${A[l]} + ${A[r]} = ${s} &lt; ${a.target}。${A[r]} 已经是能配的最大的数了，${A[l]} 和谁配都不够。`, view(), {
              at: "sum",
              kind: "warn",
              facts: [["target", a.target], ["当前和", curSum, prevSum], ["l / r", `${l} / ${r}`]],
            });
            const oldL = l;
            l++;
            snap("排除 l", `排除 numbers[${oldL}] = ${A[oldL]}，l 从 ${oldL} 右移到 ${l}。`, view(), {
              at: "small",
              facts: [["target", a.target], ["l", l, oldL], ["r", r], ["区间 [l, r]", `[${l}, ${r}]`, `[${oldL}, ${r}]`]],
            });
          } else {
            snap("太大", `${A[l]} + ${A[r]} = ${s} &gt; ${a.target}。${A[l]} 已经是能配的最小的数了，${A[r]} 和谁配都太大。`, view(), {
              at: "sum",
              kind: "warn",
              facts: [["target", a.target], ["当前和", curSum, prevSum], ["l / r", `${l} / ${r}`]],
            });
            const oldR = r;
            r--;
            snap("排除 r", `排除 numbers[${oldR}] = ${A[oldR]}，r 从 ${oldR} 左移到 ${r}。`, view(), {
              at: "big",
              facts: [["target", a.target], ["l", l], ["r", r, oldR], ["区间 [l, r]", `[${l}, ${r}]`, `[${l}, ${oldR}]`]],
            });
          }
          prevSum = curSum;
        }
        snap("没有", "l 和 r 相遇，没有答案。", view(), {
          at: "sum",
          kind: "ok",
          ans: [],
          facts: [["target", a.target], ["结果", "[]"]],
        });
      },
    },
  }, {
    key: "same-dir", t: "同向双指针：原地去重",
    body: [
      "有序数组原地去掉重复的数。<code>fast</code> 一个个往前扫，<code>slow</code> 指着「去重后的结果」的下一个空位：<code>nums[:slow]</code> 就是目前保留下来的数。",
      "fast 扫到的数和结果的最后一个 <code>nums[slow - 1]</code> 不一样，说明是个新数，写到 slow 的位置，slow 前进一格；一样就跳过。fast 走完时，前 slow 个就是答案。",
      "「移动零」（283）、「删除某个值」都是这个写法：fast 负责看，slow 负责写。",
    ],
    points: [
      { t: "和谁比", body: "和 <code>nums[slow - 1]</code>（结果的最后一个）比，而不是和 <code>nums[fast - 1]</code> 比，这样改一下就能变成「最多保留两个」（80）。" },
      { t: "后面的数不用管", body: "题目只看前 k 个数，<code>nums[k:]</code> 里剩什么都行。" },
    ],
    // 力扣只看前 k 个数；这里判题时比整个数组（六种语言写法相同，后面剩下的数也一样），所以 ret 写 void、out 写 0
    codes: [{ t: "快慢指针", key: "same-dir", code: `
class Solution:
    def removeDuplicates(self, nums: List[int]) -> int:
        slow = 1                                # nums[:slow] 是去重后的结果 #@init
        for fast in range(1, len(nums)):        # fast 往前扫每一个数 #@scan
            if nums[fast] != nums[slow - 1]:    # 和结果的最后一个不一样：是新数 #@keep
                nums[slow] = nums[fast]         #@keep
                slow += 1                       #@keep
        return slow                             #@done
` }],
    sig: { fn: "removeDuplicates", params: ["int[]"], ret: "void", out: 0 },
    call: (a) => [a.nums],
    cases: [[[1]], [[1, 1, 2]], [[0, 0, 1, 1, 1, 2, 2, 3, 3, 4]], [[2, 2, 2]]],
    gen: (R) => { const nums = R.sorted(R.arr(R.int(3, 10), 0, 6)); return { args: { nums }, note: `nums = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["c", "保留下来的结果 nums[:slow]"], ["a", "fast"], ["d", "跳过的重复"]],
      presets: [{ label: "示例 2", args: { nums: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4] }, note: "nums = [0,0,1,1,1,2,2,3,3,4]", expect: [0, 1, 2, 3, 4, 2, 2, 3, 3, 4] }],
      build(a, snap) {
        const A = a.nums.slice(), n = A.length, skip = new Set();
        let slow = 1, fast = null;
        const view = (opts = {}) => {
          const prevMap = opts.prevMap || {};
          return [{
            t: "array",
            label: "nums",
            items: A.map((v, i) => ({
              v,
              ...(prevMap[i] !== undefined ? { prev: prevMap[i] } : {}),
              cls: i === fast ? "a" : i < slow ? "c" : skip.has(i) ? "d" : "",
            })),
            ptrs: { slow: slow < n ? slow : null, ...(fast !== null ? { fast } : {}) },
            feeds: opts.feeds || [],
          }];
        };
        snap("开始", "第一个数一定保留。slow = 1：nums[:1] 是目前的结果。", view(), {
          at: "init",
          facts: [["fast", "—"], ["保留长度 k (slow)", slow], ["当前保留", `[${A[0]}]`]],
        });
        for (fast = 1; fast < n; fast++) {
          const prevFast = fast === 1 ? "—" : fast - 1;
          if (A[fast] !== A[slow - 1]) {
            const w = slow, oldVal = A[w], newVal = A[fast], prevSlow = slow;
            A[slow] = newVal;
            slow++;
            const hasOverwrite = w !== fast && oldVal !== newVal;
            snap(
              "新数",
              `nums[${fast}] = ${newVal} 和结果的最后一个 ${A[w - 1]} 不一样，${w === fast ? "原地保留" : `写到 nums[${w}]（覆盖 ${oldVal}）`}，slow 前进到 ${slow}。`,
              view({
                ...(hasOverwrite ? { prevMap: { [w]: oldVal }, feeds: [{ from: fast, to: w, win: true, label: `=${newVal}` }] } : {}),
              }),
              {
                at: ["scan", "keep"],
                facts: [["fast", fast, prevFast], ["保留长度 k (slow)", slow, prevSlow], ["当前保留", `[${A.slice(0, slow).join(", ")}]`]],
              },
            );
          } else {
            skip.add(fast);
            snap("重复", `nums[${fast}] = ${A[fast]} 和结果的最后一个一样，跳过。`, view(), {
              at: ["scan", "keep"],
              facts: [["fast", fast, prevFast], ["保留长度 k (slow)", slow], ["当前保留", `[${A.slice(0, slow).join(", ")}]`]],
            });
          }
        }
        fast = null;
        snap("完成", `返回 k = ${slow}，nums 的前 ${slow} 个是 [${A.slice(0, slow).join(", ")}]。后面剩下的数不用管。`, view(), {
          at: "done",
          kind: "ok",
          ans: A.slice(),
          facts: [["返回长度 k", slow], ["去重结果", `[${A.slice(0, slow).join(", ")}]`]],
        });
      },
    },
  }],
};
