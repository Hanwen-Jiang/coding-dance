module.exports = {
  slug: "merge-sort", name: "归并排序", kind: "algo", order: 3,
  lede: "归并排序先把数组对半分开，两半各自排好，再把两个有序的半段合并成一个。合并只要两个指针各走一遍，所以每一层 O(n)，一共 log n 层，稳定的 O(n log n)。合并的过程里还能顺手数出逆序对。",
  related: [148, 23, 21, 315],
  sections: [{
    key: "sort", t: "归并排序",
    body: [
      "<b>分</b>：把 <code>[l, r]</code> 从中间分成 <code>[l, mid]</code> 和 <code>[mid + 1, r]</code>，递归下去，直到只剩一个数（一个数天然是有序的）。",
      "<b>合</b>：两半都排好以后，用两个指针 <code>i</code>、<code>j</code> 分别指向两半的开头，每次把较小的那个放进临时数组，指针后移。一边用完了，另一边剩下的直接接上，最后拷回原数组。",
      "合并时两个数相等先拿左边的，所以相等的数先后顺序不变——归并排序是<b>稳定</b>的。代价是要 O(n) 的临时空间。",
    ],
    points: [
      { t: "临时数组只开一次", body: "在外面开一个和原数组一样长的 <code>tmp</code>，每次合并用它的 <code>[l, r]</code> 这一段，不要在递归里反复新建。" },
      { t: "链表也能归并", body: "链表排序（148）用归并最合适：找中点用快慢指针，合并就是「合并两个有序链表」（21），不需要额外的数组。" },
    ],
    codes: [{ t: "自顶向下", key: "sort", code: `
class Solution:
    def sortArray(self, nums: List[int]) -> List[int]:
        tmp = [0] * len(nums)
        def merge_sort(l: int, r: int) -> None:     # 把 nums[l..r] 排好
            if l >= r:                          #@base
                return                          #@base
            mid = (l + r) // 2                  #@split
            merge_sort(l, mid)                  # 先把两半各自排好 #@split
            merge_sort(mid + 1, r)              #@split
            i, j, k = l, mid + 1, l             # 合并两个有序的半段 #@merge
            while i <= mid and j <= r:          #@merge
                if nums[i] <= nums[j]:          # 相等时先拿左边的：稳定 #@take
                    tmp[k] = nums[i]            #@take
                    i += 1                      #@take
                else:                           #@take
                    tmp[k] = nums[j]            #@take
                    j += 1                      #@take
                k += 1                          #@take
            while i <= mid:                     # 一边用完了，另一边剩下的直接接上 #@rest
                tmp[k] = nums[i]                #@rest
                i += 1                          #@rest
                k += 1                          #@rest
            while j <= r:                       #@rest
                tmp[k] = nums[j]                #@rest
                j += 1                          #@rest
                k += 1                          #@rest
            nums[l:r + 1] = tmp[l:r + 1]        # 拷回原数组 #@copy
        merge_sort(0, len(nums) - 1)            #@start
        return nums                             #@done
` }],
    sig: { fn: "sortArray", params: ["int[]"], ret: "int[]" },
    call: (a) => [a.nums],
    cases: [[[5, 2, 3, 1]], [[5, 1, 1, 2, 0, 0]], [[7]], [[3, -1, 2, -1]]],
    gen: (R) => { const nums = R.arr(R.int(4, 8), 1, 15); return { args: { nums }, note: `nums = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["e", "左半段"], ["g", "右半段"], ["a", "i / j 指着的数"], ["c", "已经合并好"]],
      presets: [{ label: "示例", args: { nums: [6, 3, 8, 5, 2, 7, 4, 1] }, note: "nums = [6,3,8,5,2,7,4,1]", expect: [1, 2, 3, 4, 5, 6, 7, 8] }],
      build(a, snap) {
        const nums = a.nums.slice(), n = nums.length, tmp = new Array(n).fill(null);
        let L = -1, M = -1, Rr = -2, I = null, J = null;
        const view = () => [
          { t: "bars", label: "nums", items: nums.map((v, x) => ({ v, cls: x === I || x === J ? "a" : x >= L && x <= M ? "e" : x > M && x <= Rr ? "g" : "" })), ptrs: { ...(I !== null && I <= M ? { i: I } : {}), ...(J !== null && J <= Rr ? { j: J } : {}) } },
          { t: "array", label: "tmp", items: tmp.map((v, x) => ({ v: v === null ? "" : v, cls: v !== null && x >= L && x <= Rr ? "c" : "" })) },
        ];
        snap("开始", `对整个数组 [0, ${n - 1}] 做归并排序：先分，再合。`, view(), { at: "start" });
        const ms = (l, r) => {
          if (l >= r) return;
          const mid = (l + r) >> 1;
          ms(l, mid); ms(mid + 1, r);
          L = l; M = mid; Rr = r; tmp.fill(null);
          let i = l, j = mid + 1, k = l;
          I = i; J = j;
          snap("合并", `[${l}, ${mid}] 和 [${mid + 1}, ${r}] 两半都已经排好，现在合并。`, view(), { at: ["split", "merge"] });
          while (i <= mid && j <= r) {
            const left = nums[i] <= nums[j];
            tmp[k++] = left ? nums[i++] : nums[j++];
            I = i; J = j;
            snap("拿小的", left ? `${tmp[k - 1]} &lt;= ${nums[j]}，拿左边的 ${tmp[k - 1]}。` : `${nums[i]} &gt; ${tmp[k - 1]}，拿右边的 ${tmp[k - 1]}。`, view(), { at: "take" });
          }
          const rest = [];
          while (i <= mid) { rest.push(nums[i]); tmp[k++] = nums[i++]; }
          while (j <= r) { rest.push(nums[j]); tmp[k++] = nums[j++]; }
          I = J = null;
          if (rest.length) snap("接上剩下的", `一边用完了，另一边剩下的 ${rest.join("、")} 直接接到后面。`, view(), { at: "rest" });
          for (let x = l; x <= r; x++) nums[x] = tmp[x];
          snap("拷回", `把 tmp 的 [${l}, ${r}] 拷回 nums，这一段排好了。`, view(), { at: "copy" });
        };
        ms(0, n - 1);
        L = M = -1; Rr = -2; tmp.fill(null);
        snap("完成", `排好了：[${nums.join(", ")}]。`, view(), { at: "done", kind: "ok", ans: nums.slice() });
      },
    },
  }, {
    key: "count", t: "应用：数逆序对",
    body: [
      "逆序对是一对 <code>i &lt; j</code> 而 <code>record[i] &gt; record[j]</code>。暴力枚举是 O(n²)。用归并排序：一个逆序对要么在左半段内部，要么在右半段内部，要么跨过中间——前两种递归时已经数过了，只要在合并时数跨过中间的。",
      "合并时两半都是有序的。当右边的 <code>record[j]</code> 比左边的 <code>record[i]</code> 小，左边从 i 到 mid 剩下的 <code>mid - i + 1</code> 个数都比它大，一下就数出这么多对。",
    ],
    points: [
      { t: "相等的不算", body: "相等时先拿左边的，右边的数只有在严格更小时才计数。" },
      { t: "答案可能很大", body: "n 个数最多有 n(n−1)/2 对。n = 5×10⁴ 时还在 int 范围里，再大就要用 long。" },
    ],
    codes: [{ t: "合并时计数", key: "count", code: `
class Solution:
    def reversePairs(self, record: List[int]) -> int:
        tmp = [0] * len(record)
        def sort(l: int, r: int) -> int:        # 排好 record[l..r]，返回里面的逆序对数
            if l >= r:                          #@base
                return 0                        #@base
            mid = (l + r) // 2                  #@split
            cnt = sort(l, mid) + sort(mid + 1, r)   # 两半内部的逆序对 #@split
            i, j, k = l, mid + 1, l             #@merge
            while i <= mid and j <= r:          #@merge
                if record[i] <= record[j]:      #@take
                    tmp[k] = record[i]          #@take
                    i += 1                      #@take
                else:                           # 右边的更小：左边剩下的都比它大 #@cross
                    cnt += mid - i + 1          #@cross
                    tmp[k] = record[j]          #@cross
                    j += 1                      #@cross
                k += 1                          #@take,cross
            while i <= mid:                     #@rest
                tmp[k] = record[i]              #@rest
                i += 1                          #@rest
                k += 1                          #@rest
            while j <= r:                       #@rest
                tmp[k] = record[j]              #@rest
                j += 1                          #@rest
                k += 1                          #@rest
            record[l:r + 1] = tmp[l:r + 1]      #@copy
            return cnt                          #@copy
        return sort(0, len(record) - 1)         #@done
` }],
    sig: { fn: "reversePairs", params: ["int[]"], ret: "int" },
    call: (a) => [a.nums],
    cases: [[[9, 7, 5, 4, 6]], [[]], [[1, 2, 3]], [[3, 3, 3]], [[5, 4, 3, 2, 1]]],
    gen: (R) => { const nums = R.arr(R.int(4, 8), 1, 9); return { args: { nums }, note: `record = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["e", "左半段"], ["g", "右半段"], ["a", "i / j 指着的数"], ["w", "和 j 组成逆序对的数"]],
      presets: [{ label: "示例 1", args: { nums: [9, 7, 5, 4, 6] }, note: "record = [9,7,5,4,6]", expect: 8 }],
      build(a, snap) {
        const nums = a.nums.slice(), n = nums.length, tmp = new Array(n).fill(null);
        let L = -1, M = -1, Rr = -2, I = null, J = null, hot = [], total = 0;
        const view = () => [
          { t: "array", label: "record", items: nums.map((v, x) => ({ v, cls: hot.includes(x) ? "w" : x === I || x === J ? "a" : x >= L && x <= M ? "e" : x > M && x <= Rr ? "g" : "" })), ptrs: { ...(I !== null && I <= M ? { i: I } : {}), ...(J !== null && J <= Rr ? { j: J } : {}) } },
          { t: "array", label: "tmp", items: tmp.map((v) => (v === null ? "" : v)) },
        ];
        if (n < 2) { snap("完成", "不到两个数，没有逆序对。", view(), { at: ["base", "done"], kind: "ok", ans: 0, facts: [["逆序对", 0]] }); return; }
        const sort = (l, r) => {
          if (l >= r) return;
          const mid = (l + r) >> 1;
          sort(l, mid); sort(mid + 1, r);
          L = l; M = mid; Rr = r; tmp.fill(null); hot = [];
          let i = l, j = mid + 1, k = l;
          I = i; J = j;
          snap("合并", `[${l}, ${mid}] 和 [${mid + 1}, ${r}] 各自排好了，里面的逆序对也数过了。合并时数跨过中间的。`, view(), { at: ["split", "merge"], facts: [["逆序对", total]] });
          while (i <= mid && j <= r) {
            if (nums[i] <= nums[j]) { tmp[k++] = nums[i++]; I = i; hot = []; snap("拿左边", `${tmp[k - 1]} &lt;= ${nums[j]}，拿左边的，不产生逆序对。`, view(), { at: "take", facts: [["逆序对", total]] }); }
            else {
              const c = mid - i + 1;
              hot = Array.from({ length: c }, (_, x) => i + x);
              total += c;
              snap("跨过中间的逆序对", `右边的 ${nums[j]} 比左边的 ${nums[i]} 小，左边剩下的 ${c} 个数（${hot.map((x) => nums[x]).join("、")}）都比它大：多了 ${c} 对。`, view(), { at: "cross", facts: [["逆序对", total]] });
              tmp[k++] = nums[j++]; J = j; hot = [];
            }
          }
          while (i <= mid) tmp[k++] = nums[i++];
          while (j <= r) tmp[k++] = nums[j++];
          for (let x = l; x <= r; x++) nums[x] = tmp[x];
          I = J = null;
          snap("拷回", `剩下的接上，拷回 record，[${l}, ${r}] 排好了。`, view(), { at: ["rest", "copy"], facts: [["逆序对", total]] });
        };
        sort(0, n - 1);
        L = M = -1; Rr = -2; tmp.fill(null);
        snap("完成", `一共 ${total} 个逆序对。`, view(), { at: "done", kind: "ok", ans: total, facts: [["逆序对", total]] });
      },
    },
  }],
};
