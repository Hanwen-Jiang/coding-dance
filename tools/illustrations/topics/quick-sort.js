module.exports = {
  slug: "quick-sort", name: "快速排序与快速选择", kind: "algo", order: 2,
  lede: "快速排序每次选一个基准数，把数组分成「都不大于它」和「都不小于它」的两段，再分别排两段。快速选择是它的变形：找第 k 大的数时，分完以后只需要进答案所在的那一段，平均 O(n)。",
  related: [215, 75, 347],
  sections: [{
    key: "sort", t: "快速排序",
    body: [
      "<b>分区</b>是快速排序的核心。这里用的是双指针的写法（Hoare 分区）：基准取中间的数 <code>pivot</code>，<code>i</code> 从左往右找第一个 <code>&gt;= pivot</code> 的数，<code>j</code> 从右往左找第一个 <code>&lt;= pivot</code> 的数，两个都找到了就交换，然后接着找，直到 i、j 相遇。",
      "结束时 <code>[l, j]</code> 里都 <code>&lt;= pivot</code>，<code>[j + 1, r]</code> 里都 <code>&gt;= pivot</code>，两段分别递归。等于 pivot 的数两边都可能有，所以全是相同的数时也能分得很均匀，不会退化。",
      "平均 O(n log n)。基准取得不好（比如有序数组总取第一个）会退化到 O(n²)，所以取中间的数或者随机取。",
    ],
    points: [
      { t: "递归 [l, j] 和 [j+1, r]", body: "用 j 分界，不是 i。i、j 停下的条件都包含「等于」，所以两个指针不会越界，也一定能停下来。" },
      { t: "不稳定", body: "相等的数的先后顺序会被打乱。需要稳定排序时用归并排序。" },
    ],
    codes: [{ t: "双指针分区", key: "sort", code: `
class Solution:
    def sortArray(self, nums: List[int]) -> List[int]:
        def quick(l: int, r: int) -> None:      # 把 nums[l..r] 排好
            if l >= r:                          # 只剩 0 或 1 个数 #@base
                return                          #@base
            pivot = nums[(l + r) // 2]          # 取中间的数当基准 #@pivot
            i, j = l - 1, r + 1                 #@pivot
            while i < j:
                i += 1                          #@scan
                while nums[i] < pivot:          # 左边找一个 >= pivot 的 #@scan
                    i += 1                      #@scan
                j -= 1                          #@scan
                while nums[j] > pivot:          # 右边找一个 <= pivot 的 #@scan
                    j -= 1                      #@scan
                if i < j:                       #@swap
                    nums[i], nums[j] = nums[j], nums[i]     # 交换以后两边都对了 #@swap
            quick(l, j)                         # [l, j] 都 <= pivot #@recur
            quick(j + 1, r)                     # [j+1, r] 都 >= pivot #@recur
        quick(0, len(nums) - 1)                 #@start
        return nums                             #@done
` }],
    sig: { fn: "sortArray", params: ["int[]"], ret: "int[]" },
    call: (a) => [a.nums],
    cases: [[[5, 2, 3, 1]], [[5, 1, 1, 2, 0, 0]], [[7]], [[2, 2, 2, 2, 2]], [[9, 8, 7, 6, 5, 4, 3, 2, 1]]],
    gen: (R) => { const nums = R.arr(R.int(5, 9), 1, 15); return { args: { nums }, note: `nums = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["a", "i / j 停下的位置"], ["e", "这次分区的范围"], ["b", "基准值"], ["c", "已经排好"]],
      presets: [
        { label: "示例", args: { nums: [6, 3, 8, 5, 2, 7, 4, 1] }, note: "nums = [6,3,8,5,2,7,4,1]", expect: [1, 2, 3, 4, 5, 6, 7, 8] },
        { label: "有重复", args: { nums: [5, 1, 1, 2, 0, 0] }, note: "nums = [5,1,1,2,0,0]", expect: [0, 0, 1, 1, 2, 5] },
      ],
      build(a, snap) {
        const nums = a.nums.slice(), n = nums.length, done = new Array(n).fill(false);
        let L = -1, Rr = -2, I = null, J = null, pv = null;
        const view = () => [{ t: "bars", label: pv === null ? "nums" : `nums（基准 pivot = ${pv}）`, items: nums.map((v, k) => ({ v, cls: k === I || k === J ? "a" : done[k] ? "c" : k >= L && k <= Rr ? (v === pv ? "b" : "e") : "" })), ptrs: { ...(I !== null && I >= 0 && I < n ? { i: I } : {}), ...(J !== null && J >= 0 && J < n ? { j: J } : {}) } }];
        snap("开始", `对整个数组 [0, ${n - 1}] 做快速排序。`, view(), { at: "start" });
        const quick = (l, r) => {
          if (l >= r) { if (l === r) done[l] = true; return; }
          L = l; Rr = r; pv = nums[(l + r) >> 1]; I = null; J = null;
          snap("选基准", `排 [${l}, ${r}]：取中间的数 nums[${(l + r) >> 1}] = ${pv} 当基准。i 从 ${l - 1}、j 从 ${r + 1} 开始。`, view(), { at: "pivot" });
          let i = l - 1, j = r + 1;
          while (i < j) {
            i++; while (nums[i] < pv) i++;
            j--; while (nums[j] > pv) j--;
            I = i; J = j;
            if (i < j) {
              snap("找到一对", `i 停在 ${i}（${nums[i]} &gt;= ${pv}），j 停在 ${j}（${nums[j]} &lt;= ${pv}）。i &lt; j，它们站错了边。`, view(), { at: "scan" });
              [nums[i], nums[j]] = [nums[j], nums[i]];
              snap("交换", `交换以后 nums[${i}] = ${nums[i]}，nums[${j}] = ${nums[j]}，两边都对了，接着找。`, view(), { at: "swap" });
            } else snap("相遇", `i 停在 ${i}，j 停在 ${j}，i &gt;= j，分区结束。`, view(), { at: ["scan", "swap"] });
          }
          I = null; J = j;
          snap("分成两段", `[${l}, ${j}] 里的数都 &lt;= ${pv}，[${j + 1}, ${r}] 里的都 &gt;= ${pv}。两段分别递归。`, view(), { at: "recur" });
          quick(l, j); quick(j + 1, r);
        };
        quick(0, n - 1);
        L = -1; Rr = -2; I = J = pv = null; done.fill(true);
        snap("完成", `排好了：[${nums.join(", ")}]。`, view(), { at: "done", kind: "ok", ans: nums.slice() });
      },
    },
  }, {
    key: "select", t: "快速选择：第 k 大的数",
    body: [
      "第 k 大的数就是从小到大排好后下标为 <code>n - k</code> 的数。分区一次以后，<code>[l, j]</code> 里的数都不大于 <code>[j + 1, r]</code> 里的数，所以只要看 <code>n - k</code> 落在哪一段，<b>只进那一段</b>继续分，另一段不用管。",
      "每次范围大约减半，总共 n + n/2 + n/4 + … ≈ 2n，平均 O(n)，比排序的 O(n log n) 快。也可以用大小为 k 的最小堆，O(n log k)，见「堆排序与 Top K」。",
    ],
    points: [
      { t: "范围缩到一个数", body: "<code>l == r</code> 时就是答案。用 while 循环写，不用递归。" },
      { t: "会改动原数组", body: "快速选择会打乱 nums。不能改原数组时先复制一份。" },
    ],
    codes: [{ t: "只进答案所在的那一段", key: "select", code: `
class Solution:
    def findKthLargest(self, nums: List[int], k: int) -> int:
        target = len(nums) - k              # 第 k 大 = 从小到大排好后下标 n-k 的数 #@init
        l, r = 0, len(nums) - 1             #@init
        while l < r:
            pivot = nums[(l + r) // 2]      #@pivot
            i, j = l - 1, r + 1             #@pivot
            while i < j:
                i += 1                      #@scan
                while nums[i] < pivot:      #@scan
                    i += 1                  #@scan
                j -= 1                      #@scan
                while nums[j] > pivot:      #@scan
                    j -= 1                  #@scan
                if i < j:                   #@swap
                    nums[i], nums[j] = nums[j], nums[i]     #@swap
            if target <= j:                 # 答案在左边一段 #@go
                r = j                       #@go
            else:                           # 答案在右边一段 #@go
                l = j + 1                   #@go
        return nums[l]                      #@done
` }],
    sig: { fn: "findKthLargest", params: ["int[]", "int"], ret: "int" },
    call: (a) => [a.nums, a.k],
    cases: [[[3, 2, 1, 5, 6, 4], 2], [[3, 2, 3, 1, 2, 4, 5, 5, 6], 4], [[1], 1], [[2, 2, 2], 3]],
    gen: (R) => { const nums = R.arr(R.int(5, 9), 1, 15), k = R.int(1, nums.length); return { args: { nums, k }, note: `nums = ${R.fmt(nums)}, k = ${k}` }; },
    demo: {
      legend: [["a", "i / j 停下的位置"], ["e", "答案还可能在的范围"], ["b", "基准值"], ["c", "答案"]],
      presets: [{ label: "示例 1", args: { nums: [3, 2, 1, 5, 6, 4], k: 2 }, note: "nums = [3,2,1,5,6,4], k = 2", expect: 5 }],
      build(a, snap) {
        const nums = a.nums.slice(), n = nums.length, t = n - a.k;
        let l = 0, r = n - 1, I = null, J = null, pv = null, hit = -1;
        const view = () => [{ t: "bars", label: pv === null ? "nums" : `nums（基准 pivot = ${pv}）`, items: nums.map((v, x) => ({ v, cls: x === hit ? "c" : x === I || x === J ? "a" : x >= l && x <= r ? (v === pv ? "b" : "e") : "" })), ptrs: { target: t, ...(I !== null && I < n ? { i: I } : {}), ...(J !== null && J >= 0 ? { j: J } : {}) } }];
        snap("开始", `第 ${a.k} 大的数，就是排好后下标为 ${n} - ${a.k} = ${t} 的数。范围是整个数组。`, view(), { at: "init" });
        while (l < r) {
          pv = nums[(l + r) >> 1]; I = J = null;
          snap("选基准", `在 [${l}, ${r}] 里取中间的数 ${pv} 当基准，分区。`, view(), { at: "pivot" });
          let i = l - 1, j = r + 1;
          while (i < j) {
            i++; while (nums[i] < pv) i++;
            j--; while (nums[j] > pv) j--;
            I = i; J = j;
            if (i < j) { [nums[i], nums[j]] = [nums[j], nums[i]]; snap("交换", `i 停在 ${i}、j 停在 ${j}，交换这两个数。`, view(), { at: ["scan", "swap"] }); }
            else snap("相遇", `i = ${i}，j = ${j}，分区结束。`, view(), { at: ["scan", "swap"] });
          }
          I = null;
          if (t <= j) { r = j; snap("去左边", `[${l}, ${j}] 都 &lt;= ${pv}。target = ${t} &lt;= ${j}，答案在左边一段，右边不用管了。`, view(), { at: "go" }); }
          else { l = j + 1; snap("去右边", `[${j + 1}, ${r}] 都 &gt;= ${pv}。target = ${t} &gt; ${j}，答案在右边一段，左边不用管了。`, view(), { at: "go" }); }
          J = null;
        }
        pv = null; hit = l;
        snap("完成", `范围缩到只剩下标 ${l}，nums[${l}] = ${nums[l]} 就是第 ${a.k} 大的数。`, view(), { at: "done", kind: "ok", ans: nums[l] });
      },
    },
  }],
};
