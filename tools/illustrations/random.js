// 每道题演示的「随机」输入。GEN[题号](R) 返回 { args, note, py, cmp }：
//   args 交给 spec 的 build 生成演示，note 是显示给人看的输入说明；
//   py 是一段 Python 表达式（用标准解法算同一个输入），build 时拿它核对演示给出的答案，网站上不用；
//   cmp：答案的比较方式，默认完全相等；"unordered" 忽略列表顺序；"length" 只比较长度（答案不唯一的题）。
// 规模都控制在演示看得过来的范围内，并且满足题目的约束（有唯一答案、数组有序等）。
// R 是 makeR() 给的工具函数。GEN 里的函数会被转成字符串嵌进网页，所以只能用参数 R，不能引用外面的变量。

function makeR() {
  const int = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (xs) => xs[int(0, xs.length - 1)];
  const chance = (p) => Math.random() < p;
  const shuffle = (xs) => {
    const a = xs.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const arr = (n, a, b) => Array.from({ length: n }, () => int(a, b));
  const distinct = (n, a, b) => shuffle(Array.from({ length: b - a + 1 }, (_, i) => a + i)).slice(0, n);
  const sorted = (xs) => xs.slice().sort((x, y) => x - y);
  const word = (n, abc) => Array.from({ length: n }, () => pick(abc)).join("");
  const fmt = (x) => JSON.stringify(x);
  const py = (x) => JSON.stringify(x).replace(/null/g, "None").replace(/true/g, "True").replace(/false/g, "False");
  // 二叉树用「堆下标」表示：下标 i 的孩子是 2i+1、2i+2，最多 4 层（下标 < 31）
  const toLc = (heap) => {
    const out = [];
    const q = heap.length && heap[0] != null ? [0] : [];
    while (q.length) {
      const i = q.shift();
      if (i < 0) { out.push(null); continue; }
      out.push(heap[i]);
      for (const c of [2 * i + 1, 2 * i + 2]) q.push(heap[c] != null ? c : -1);
    }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  };
  const trim = (heap) => {
    while (heap.length && heap[heap.length - 1] == null) heap.pop();
    return heap;
  };
  /** 随机形状的树，n 个节点，值由 val(k) 给出 */
  const tree = (n, val, maxId = 30) => {
    const ids = [0];
    let guard = 0;
    while (ids.length < n && guard++ < 500) {
      const p = pick(ids), c = 2 * p + int(1, 2);
      if (c <= maxId && !ids.includes(c)) ids.push(c);
    }
    const heap = [];
    ids.sort((a, b) => a - b).forEach((id, k) => (heap[id] = val(k)));
    for (let i = 0; i < heap.length; i++) if (heap[i] === undefined) heap[i] = null;
    trim(heap);
    return { heap, lc: toLc(heap) };
  };
  /** 把一串不同的值依次插入二叉搜索树，超过 4 层的值丢掉 */
  const bst = (vals) => {
    const heap = [];
    for (const v of vals) {
      let i = 0;
      while (heap[i] != null && i <= 30) i = v < heap[i] ? 2 * i + 1 : 2 * i + 2;
      if (i <= 30) heap[i] = v;
    }
    for (let i = 0; i < heap.length; i++) if (heap[i] === undefined) heap[i] = null;
    trim(heap);
    return { heap, lc: toLc(heap) };
  };
  return { int, pick, chance, shuffle, arr, distinct, sorted, word, fmt, py, tree, bst, toLc };
}

const GEN = {
  1: (R) => {
    for (;;) {
      const nums = R.distinct(R.int(4, 7), 1, 15);
      const i = R.int(0, nums.length - 2), j = R.int(i + 1, nums.length - 1), target = nums[i] + nums[j];
      let pairs = 0;
      for (let a = 0; a < nums.length; a++) for (let b = a + 1; b < nums.length; b++) if (nums[a] + nums[b] === target) pairs++;
      if (pairs === 1) return { args: { nums, target }, note: `nums = ${R.fmt(nums)}, target = ${target}`, py: `Solution().twoSum(${R.py(nums)}, ${target})` };
    }
  },
  2: (R) => {
    const num = () => { const d = R.arr(R.int(1, 4), 0, 9); if (d.length > 1 && d[d.length - 1] === 0) d[d.length - 1] = R.int(1, 9); return d; };
    const x = num(), y = num();
    return { args: { x, y }, note: `l1 = ${R.fmt(x)}, l2 = ${R.fmt(y)}`, py: `toL(Solution().addTwoNumbers(L(${R.py(x)}), L(${R.py(y)})))` };
  },
  3: (R) => {
    const s = R.word(R.int(6, 11), R.pick(["abc", "abcd", "abcde"]));
    return { args: { s }, note: `s = "${s}"`, py: `Solution().lengthOfLongestSubstring("${s}")` };
  },
  4: (R) => {
    const A = R.sorted(R.arr(R.int(1, 5), 0, 25)), B = R.sorted(R.arr(R.int(1, 6), 0, 25));
    return { args: { A, B }, note: `nums1 = ${R.fmt(A)}, nums2 = ${R.fmt(B)}`, py: `Solution().findMedianSortedArrays(${R.py(A)}, ${R.py(B)})` };
  },
  5: (R) => {
    const s = R.word(R.int(5, 9), R.pick(["ab", "abc", "aab"]));
    return { args: { s }, note: `s = "${s}"`, py: `len(Solution().longestPalindrome("${s}"))`, cmp: "length" };
  },
  11: (R) => {
    const h = R.arr(R.int(6, 10), 1, 9);
    return { args: { h }, note: `height = ${R.fmt(h)}`, py: `Solution().maxArea(${R.py(h)})` };
  },
  15: (R) => {
    const nums = R.arr(R.int(6, 9), -4, 4);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().threeSum(${R.py(nums)})`, cmp: "unordered" };
  },
  17: (R) => {
    const d = R.word(R.int(1, 3), R.chance(0.5) ? "23456" : "234568");
    // 超过两位时演示只逐步播前几个组合，最后给出的是组合个数
    if (d.length > 2) return { args: { d }, note: `digits = "${d}"（只演示前几个组合的过程）`, py: `len(Solution().letterCombinations("${d}"))` };
    return { args: { d }, note: `digits = "${d}"`, py: `Solution().letterCombinations("${d}")`, cmp: "unordered" };
  },
  19: (R) => {
    const v = R.arr(R.int(1, 7), 1, 9), n = R.int(1, v.length);
    return { args: { v, n }, note: `head = ${R.fmt(v)}, n = ${n}`, py: `toL(Solution().removeNthFromEnd(L(${R.py(v)}), ${n}))` };
  },
  20: (R) => {
    // 一半是随机生成的合法括号串（k 对括号），一半是乱序的括号
    const valid = (k) => {
      if (k <= 0) return "";
      const [o, c] = R.pick(["()", "[]", "{}"]), inner = R.int(0, k - 1);
      return o + valid(inner) + c + valid(k - 1 - inner);
    };
    const s = R.chance(0.5) ? valid(R.int(1, 4)) : R.word(R.int(2, 8), "()[]{}");
    return { args: { s }, note: `s = "${s}"`, py: `Solution().isValid("${s}")` };
  },
  21: (R) => {
    const x = R.sorted(R.arr(R.int(0, 5), 1, 9)), y = R.sorted(R.arr(R.int(1, 5), 1, 9));
    return { args: { x, y }, note: `list1 = ${R.fmt(x)}, list2 = ${R.fmt(y)}`, py: `toL(Solution().mergeTwoLists(L(${R.py(x)}), L(${R.py(y)})))` };
  },
  22: (R) => {
    const n = R.int(2, 3);
    return { args: { n }, note: `n = ${n}`, py: `Solution().generateParenthesis(${n})` };
  },
  23: (R) => {
    const ls = Array.from({ length: R.int(2, 4) }, () => R.sorted(R.arr(R.int(1, 4), 1, 9)));
    return { args: { ls }, note: `lists = ${R.fmt(ls)}`, py: `toL(Solution().mergeKLists([L(x) for x in ${R.py(ls)}]))` };
  },
  24: (R) => {
    const v = R.arr(R.int(2, 7), 1, 9);
    return { args: { v }, note: `head = ${R.fmt(v)}`, py: `toL(Solution().swapPairs(L(${R.py(v)})))` };
  },
  25: (R) => {
    const v = R.distinct(R.int(4, 8), 1, 9), k = R.int(2, 3);
    return { args: { v, k }, note: `head = ${R.fmt(v)}, k = ${k}`, py: `toL(Solution().reverseKGroup(L(${R.py(v)}), ${k}))` };
  },
  31: (R) => {
    const nums = R.arr(R.int(3, 6), 1, 5);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `__inplace(Solution().nextPermutation, ${R.py(nums)})` };
  },
  32: (R) => {
    const s = R.word(R.int(5, 10), "()");
    return { args: { s }, note: `s = "${s}"`, py: `Solution().longestValidParentheses("${s}")` };
  },
  33: (R) => {
    const base = R.sorted(R.distinct(R.int(5, 9), 0, 20)), r = R.int(0, base.length - 1);
    const nums = base.slice(r).concat(base.slice(0, r));
    const target = R.chance(0.7) ? R.pick(nums) : R.int(0, 21);
    return { args: { nums, target }, note: `nums = ${R.fmt(nums)}, target = ${target}`, py: `Solution().search(${R.py(nums)}, ${target})` };
  },
  34: (R) => {
    const nums = R.sorted(R.arr(R.int(5, 10), 1, 6)), target = R.int(1, 7);
    return { args: { nums, target }, note: `nums = ${R.fmt(nums)}, target = ${target}`, py: `Solution().searchRange(${R.py(nums)}, ${target})` };
  },
  35: (R) => {
    const nums = R.sorted(R.distinct(R.int(3, 7), 1, 15)), target = R.int(0, 16);
    return { args: { nums, target }, note: `nums = ${R.fmt(nums)}, target = ${target}`, py: `Solution().searchInsert(${R.py(nums)}, ${target})` };
  },
  39: (R) => {
    const c = R.sorted(R.distinct(R.int(2, 4), 2, 7)), target = R.int(5, 9);
    return { args: { c, target }, note: `candidates = ${R.fmt(c)}, target = ${target}`, py: `Solution().combinationSum(${R.py(c)}, ${target})`, cmp: "unordered" };
  },
  41: (R) => {
    const nums = R.arr(R.int(4, 7), -2, 7);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().firstMissingPositive(${R.py(nums)})` };
  },
  42: (R) => {
    const h = R.arr(R.int(8, 12), 0, 4);
    return { args: { h }, note: `height = ${R.fmt(h)}`, py: `Solution().trap(${R.py(h)})` };
  },
  45: (R) => {
    const nums = R.arr(R.int(4, 8), 1, 3);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().jump(${R.py(nums)})` };
  },
  46: (R) => {
    const nums = R.distinct(R.int(2, 3), 0, 9);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().permute(${R.py(nums)})`, cmp: "unordered" };
  },
  48: (R) => {
    const n = R.int(2, 4), m = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i * n + j + 1));
    return { args: { m }, note: `matrix = ${R.fmt(m)}`, py: `__inplace(Solution().rotate, ${R.py(m)})` };
  },
  49: (R) => {
    const groups = R.shuffle([["eat", "tea", "ate", "eta"], ["tan", "nat", "ant"], ["bat", "tab"], ["opt", "top", "pot"], ["dog", "god"]]).slice(0, R.int(2, 3));
    const strs = R.shuffle(groups.flatMap((g) => R.shuffle(g).slice(0, R.int(1, g.length))));
    return { args: { strs }, note: `strs = ${R.fmt(strs)}`, py: `Solution().groupAnagrams(${R.py(strs)})`, cmp: "unordered" };
  },
  51: (R) => {
    const n = R.int(4, 5);
    return { args: { n }, note: `n = ${n}`, py: `Solution().solveNQueens(${n})`, cmp: "unordered" };
  },
  53: (R) => {
    const nums = R.arr(R.int(6, 9), -5, 5);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().maxSubArray(${R.py(nums)})` };
  },
  54: (R) => {
    const r = R.int(2, 4), c = R.int(2, 4), m = Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => i * c + j + 1));
    return { args: { m }, note: `matrix = ${R.fmt(m)}`, py: `Solution().spiralOrder(${R.py(m)})` };
  },
  55: (R) => {
    const nums = R.arr(R.int(4, 7), 0, 3);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().canJump(${R.py(nums)})` };
  },
  56: (R) => {
    const iv = Array.from({ length: R.int(3, 5) }, () => { const s = R.int(0, 12); return [s, s + R.int(0, 4)]; });
    return { args: { iv }, note: `intervals = ${R.fmt(iv)}`, py: `Solution().merge(${R.py(iv)})`, cmp: "unordered" };
  },
  62: (R) => {
    const m = R.int(2, 4), n = R.int(2, 6);
    return { args: { m, n }, note: `m = ${m}, n = ${n}`, py: `Solution().uniquePaths(${m}, ${n})` };
  },
  64: (R) => {
    const grid = Array.from({ length: R.int(2, 4) }, () => R.arr(3, 1, 9));
    return { args: { grid }, note: `grid = ${R.fmt(grid)}`, py: `Solution().minPathSum(${R.py(grid)})` };
  },
  70: (R) => {
    const n = R.int(2, 9);
    return { args: { n }, note: `n = ${n}`, py: `Solution().climbStairs(${n})` };
  },
  72: (R) => {
    const w1 = R.word(R.int(2, 5), "abcde"), w2 = R.word(R.int(2, 5), "abcde");
    return { args: { w1, w2 }, note: `word1 = "${w1}", word2 = "${w2}"`, py: `Solution().minDistance("${w1}", "${w2}")` };
  },
  73: (R) => {
    const r = R.int(3, 4), c = R.int(3, 4);
    const m = Array.from({ length: r }, () => Array.from({ length: c }, () => (R.chance(0.15) ? 0 : R.int(1, 9))));
    if (!m.flat().includes(0)) m[R.int(0, r - 1)][R.int(0, c - 1)] = 0;
    return { args: { m }, note: `matrix = ${R.fmt(m)}`, py: `__inplace(Solution().setZeroes, ${R.py(m)})` };
  },
  74: (R) => {
    const r = R.int(2, 3), c = R.int(3, 4), flat = R.sorted(R.distinct(r * c, 1, 60));
    const M = Array.from({ length: r }, (_, i) => flat.slice(i * c, i * c + c));
    const target = R.chance(0.5) ? R.pick(flat) : R.int(1, 61);
    return { args: { M, target }, note: `matrix = ${R.fmt(M)}, target = ${target}`, py: `Solution().searchMatrix(${R.py(M)}, ${target})` };
  },
  75: (R) => {
    const nums = R.arr(R.int(4, 8), 0, 2);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `__inplace(Solution().sortColors, ${R.py(nums)})` };
  },
  76: (R) => {
    const s = R.word(R.int(8, 13), "ABCDE"), t = R.word(R.int(2, 3), "ABC");
    return { args: { s, t }, note: `s = "${s}", t = "${t}"`, py: `len(Solution().minWindow("${s}", "${t}"))`, cmp: "length" };
  },
  78: (R) => {
    const nums = R.distinct(R.int(2, 4), 0, 9);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().subsets(${R.py(nums)})`, cmp: "unordered" };
  },
  79: (R) => {
    const rows = 3, cols = 4, B = Array.from({ length: rows }, () => R.word(cols, "ABCDE"));
    let word;
    if (R.chance(0.6)) {
      // 在网格里随机走一条不重复的路，保证能找到
      let i = R.int(0, rows - 1), j = R.int(0, cols - 1);
      const seen = new Set([`${i},${j}`]);
      word = B[i][j];
      const len = R.int(3, 5);
      while (word.length < len) {
        const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < rows && y < cols && !seen.has(`${x},${y}`));
        if (!nb.length) break;
        [i, j] = R.pick(nb);
        seen.add(`${i},${j}`);
        word += B[i][j];
      }
    } else word = R.word(R.int(3, 4), "ABCDE");
    return { args: { board: B, word }, note: `board = ${R.fmt(B)}, word = "${word}"`, py: `Solution().exist([list(r) for r in ${R.py(B)}], "${word}")` };
  },
  84: (R) => {
    const h = R.arr(R.int(5, 8), 1, 6);
    return { args: { h }, note: `heights = ${R.fmt(h)}`, py: `Solution().largestRectangleArea(${R.py(h)})` };
  },
  94: (R) => {
    const t = R.tree(R.int(3, 7), () => R.int(1, 9));
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `Solution().inorderTraversal(T(${R.py(t.lc)}))` };
  },
  98: (R) => {
    const vals = R.distinct(R.int(4, 7), 1, 20);
    const t = R.chance(0.5) ? R.bst(vals) : R.tree(vals.length, (k) => vals[k]);
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `Solution().isValidBST(T(${R.py(t.lc)}))` };
  },
  101: (R) => {
    let t;
    if (R.chance(0.55)) {
      // 先随机一棵左子树，再镜像出右子树
      const half = R.tree(R.int(1, 3), () => R.int(1, 5), 6);
      const heap = [R.int(1, 5)];
      const place = (src, dst, mirror) => {
        if (half.heap[src] == null) return;
        heap[dst] = half.heap[src];
        const [a, b] = [2 * src + 1, 2 * src + 2];
        place(a, mirror ? 2 * dst + 2 : 2 * dst + 1, mirror);
        place(b, mirror ? 2 * dst + 1 : 2 * dst + 2, mirror);
      };
      place(0, 1, false);
      place(0, 2, true);
      for (let i = 0; i < heap.length; i++) if (heap[i] === undefined) heap[i] = null;
      t = { heap, lc: R.toLc(heap) };
    } else t = R.tree(R.int(3, 7), () => R.int(1, 3));
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `Solution().isSymmetric(T(${R.py(t.lc)}))` };
  },
  102: (R) => {
    const t = R.tree(R.int(3, 8), () => R.int(1, 20));
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `Solution().levelOrder(T(${R.py(t.lc)}))` };
  },
  104: (R) => {
    const t = R.tree(R.int(2, 8), () => R.int(1, 20));
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `Solution().maxDepth(T(${R.py(t.lc)}))` };
  },
  105: (R) => {
    const vals = R.distinct(R.int(3, 7), 1, 20), t = R.tree(vals.length, (k) => vals[k]);
    const pre = [], ino = [];
    const walk = (i) => { if (t.heap[i] == null) return; pre.push(t.heap[i]); walk(2 * i + 1); ino.push(t.heap[i]); walk(2 * i + 2); };
    walk(0);
    return { args: { pre, ino }, note: `preorder = ${R.fmt(pre)}, inorder = ${R.fmt(ino)}`, py: `toT(Solution().buildTree(${R.py(pre)}, ${R.py(ino)}))` };
  },
  108: (R) => {
    const nums = R.sorted(R.distinct(R.int(3, 7), -10, 10));
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `__pre(Solution().sortedArrayToBST(${R.py(nums)}))` };
  },
  114: (R) => {
    const t = R.tree(R.int(3, 7), () => R.int(1, 9));
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `__flat(T(${R.py(t.lc)}))` };
  },
  118: (R) => {
    const n = R.int(2, 6);
    return { args: { n }, note: `numRows = ${n}`, py: `Solution().generate(${n})` };
  },
  121: (R) => {
    const prices = R.arr(R.int(5, 8), 1, 9);
    return { args: { prices }, note: `prices = ${R.fmt(prices)}`, py: `Solution().maxProfit(${R.py(prices)})` };
  },
  124: (R) => {
    const t = R.tree(R.int(2, 7), () => R.int(-9, 9));
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `Solution().maxPathSum(T(${R.py(t.lc)}))` };
  },
  128: (R) => {
    const nums = R.arr(R.int(5, 9), 0, 12);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().longestConsecutive(${R.py(nums)})` };
  },
  131: (R) => {
    const s = R.word(R.int(3, 5), R.pick(["ab", "aab", "abc"]));
    return { args: { s }, note: `s = "${s}"`, py: `Solution().partition("${s}")`, cmp: "unordered" };
  },
  136: (R) => {
    const vals = R.distinct(R.int(3, 4), 1, 9), single = vals.pop();
    const nums = R.shuffle([...vals, ...vals, single]);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().singleNumber(${R.py(nums)})` };
  },
  138: (R) => {
    const n = R.int(2, 5), d = Array.from({ length: n }, () => [R.int(1, 20), R.chance(0.25) ? null : R.int(0, n - 1)]);
    return { args: { d }, note: `head = ${R.fmt(d)}`, py: `__dump138(Solution().copyRandomList(__mk138(${R.py(d)})))` };
  },
  139: (R) => {
    const words = R.shuffle(["a", "ab", "abc", "b", "bc", "ca", "cab"]).slice(0, R.int(3, 4));
    let s = "";
    if (R.chance(0.6)) while (s.length < 5) s += R.pick(words);
    else s = R.word(R.int(4, 7), "abc");
    s = s.slice(0, 9);
    return { args: { s, words }, note: `s = "${s}", wordDict = ${R.fmt(words)}`, py: `Solution().wordBreak("${s}", ${R.py(words)})` };
  },
  141: (R) => {
    const v = R.arr(R.int(2, 7), -5, 9), pos = R.chance(0.6) ? R.int(0, v.length - 1) : -1;
    return { args: { v, pos }, note: `head = ${R.fmt(v)}, pos = ${pos}`, py: `Solution().hasCycle(__cyc(${R.py(v)}, ${pos}))` };
  },
  142: (R) => {
    const v = R.arr(R.int(2, 7), -5, 9), pos = R.chance(0.65) ? R.int(0, v.length - 1) : -1;
    return { args: { v, pos }, note: `head = ${R.fmt(v)}, pos = ${pos}`, py: `__idx(${R.py(v)}, ${pos})` };
  },
  146: (R) => {
    const cap = R.int(1, 3), ops = [];
    for (let k = R.int(6, 9); k > 0; k--) ops.push(R.chance(0.55) ? ["put", R.int(1, 4), R.int(1, 9)] : ["get", R.int(1, 4)]);
    if (ops[0][0] === "get") ops[0] = ["put", R.int(1, 4), R.int(1, 9)];
    const txt = ops.map((o) => (o[0] === "put" ? `put(${o[1]},${o[2]})` : `get(${o[1]})`)).join(" ");
    return { args: { cap, ops }, note: `容量 ${cap}：${txt}`, py: `__ops(LRUCache(${cap}), ${R.py(ops)})` };
  },
  148: (R) => {
    const v = R.arr(R.int(3, 7), 1, 9);
    return { args: { v }, note: `head = ${R.fmt(v)}`, py: `toL(Solution().sortList(L(${R.py(v)})))` };
  },
  152: (R) => {
    const nums = R.arr(R.int(4, 7), -3, 3);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().maxProduct(${R.py(nums)})` };
  },
  153: (R) => {
    const base = R.sorted(R.distinct(R.int(4, 8), 0, 20)), r = R.int(0, base.length - 1);
    const nums = base.slice(r).concat(base.slice(0, r));
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().findMin(${R.py(nums)})` };
  },
  155: (R) => {
    const ops = [];
    let size = 0;
    for (let k = R.int(6, 9); k > 0; k--) {
      if (!size || R.chance(0.45)) { ops.push(["push", R.int(-5, 5)]); size++; }
      else { const op = R.pick(["pop", "top", "getMin", "getMin"]); ops.push([op]); if (op === "pop") size--; }
    }
    const txt = ops.map((o) => (o[0] === "push" ? `push(${o[1]})` : `${o[0]}()`)).join(" ");
    return { args: { ops }, note: txt, py: `__ops(MinStack(), ${R.py(ops)})` };
  },
  160: (R) => {
    const cm = R.chance(0.7) ? R.arr(R.int(1, 3), 1, 9) : [];
    const xa = R.arr(R.int(cm.length ? 0 : 1, 3), 1, 9), xb = R.arr(R.int(cm.length ? 0 : 1, 3), 1, 9);
    const A = xa.concat(cm), B = xb.concat(cm);
    return { args: { xa, xb, cm }, note: `A = ${R.fmt(A)}, B = ${R.fmt(B)}，${cm.length ? `从 ${cm[0]} 开始共用 ${R.fmt(cm)}` : "不相交"}`, py: `__n160(Solution().getIntersectionNode(*__inter(${R.py(xa)}, ${R.py(xb)}, ${R.py(cm)})))` };
  },
  169: (R) => {
    const n = R.int(5, 9), maj = R.int(1, 9), cnt = Math.floor(n / 2) + R.int(1, 2);
    const nums = R.shuffle([...Array(Math.min(cnt, n)).fill(maj), ...R.arr(Math.max(0, n - cnt), 1, 9).map((x) => (x === maj ? (x % 9) + 1 : x))]);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().majorityElement(${R.py(nums)})` };
  },
  189: (R) => {
    const nums = Array.from({ length: R.int(4, 8) }, (_, i) => i + 1), k = R.int(0, 10);
    return { args: { nums, k }, note: `nums = ${R.fmt(nums)}, k = ${k}`, py: `__inplace(Solution().rotate, ${R.py(nums)}, ${k})` };
  },
  198: (R) => {
    const nums = R.arr(R.int(4, 8), 0, 9);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().rob(${R.py(nums)})` };
  },
  199: (R) => {
    const t = R.tree(R.int(3, 8), () => R.int(1, 9));
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `Solution().rightSideView(T(${R.py(t.lc)}))` };
  },
  206: (R) => {
    const v = R.arr(R.int(2, 7), 1, 9);
    return { args: { v }, note: `head = ${R.fmt(v)}`, py: `toL(Solution().reverseList(L(${R.py(v)})))` };
  },
  207: (R) => {
    const n = R.int(3, 5), pre = [];
    for (let k = R.int(2, 5); k > 0; k--) {
      const a = R.int(0, n - 1), b = R.int(0, n - 1);
      if (a !== b && !pre.some(([x, y]) => x === a && y === b)) pre.push([a, b]);
    }
    if (!pre.length) pre.push([1, 0]);
    return { args: { n, pre }, note: `numCourses = ${n}, prerequisites = ${R.fmt(pre)}`, py: `Solution().canFinish(${n}, ${R.py(pre)})` };
  },
  208: (R) => {
    const vocab = ["app", "apple", "ape", "bat", "ball", "cat", "car"], ops = [];
    for (let k = R.int(6, 8); k > 0; k--) {
      const w = R.pick(vocab);
      if (!ops.length || R.chance(0.4)) ops.push(["insert", w]);
      else if (R.chance(0.5)) ops.push(["search", R.chance(0.5) ? w : w.slice(0, R.int(1, w.length - 1))]);
      else ops.push(["startsWith", w.slice(0, R.int(1, w.length))]);
    }
    return { args: { ops }, note: ops.map(([o, w]) => `${o}("${w}")`).join(" "), py: `__ops(Trie(), ${R.py(ops)})` };
  },
  226: (R) => {
    const t = R.tree(R.int(3, 7), () => R.int(1, 9));
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `__lv(Solution().invertTree(T(${R.py(t.lc)})))` };
  },
  230: (R) => {
    const t = R.bst(R.distinct(R.int(3, 7), 1, 20)), n = t.heap.filter((x) => x != null).length, k = R.int(1, n);
    return { args: { t: t.heap, k }, note: `root = ${R.fmt(t.lc)}, k = ${k}`, py: `Solution().kthSmallest(T(${R.py(t.lc)}), ${k})` };
  },
  234: (R) => {
    let v = R.arr(R.int(1, 4), 1, 5);
    if (R.chance(0.55)) v = v.concat(R.chance(0.5) ? [R.int(1, 5)] : [], v.slice().reverse());
    else v = v.concat(R.arr(R.int(1, 3), 1, 5));
    return { args: { v }, note: `head = ${R.fmt(v)}`, py: `Solution().isPalindrome(L(${R.py(v)}))` };
  },
  238: (R) => {
    const nums = R.arr(R.int(3, 6), -2, 4);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().productExceptSelf(${R.py(nums)})` };
  },
  239: (R) => {
    const nums = R.arr(R.int(5, 9), -3, 9), k = R.int(1, Math.min(4, nums.length));
    return { args: { nums, k }, note: `nums = ${R.fmt(nums)}, k = ${k}`, py: `Solution().maxSlidingWindow(${R.py(nums)}, ${k})` };
  },
  240: (R) => {
    const t = R.int(0, 31);
    return { args: { t }, note: `target = ${t}`, py: `Solution().searchMatrix([[1,4,7,11,15],[2,5,8,12,19],[3,6,9,16,22],[10,13,14,17,24],[18,21,23,26,30]], ${t})` };
  },
  279: (R) => {
    const n = R.int(2, 20);
    return { args: { n }, note: `n = ${n}`, py: `Solution().numSquares(${n})` };
  },
  283: (R) => {
    const nums = Array.from({ length: R.int(4, 8) }, () => (R.chance(0.4) ? 0 : R.int(1, 9)));
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `__inplace(Solution().moveZeroes, ${R.py(nums)})` };
  },
  287: (R) => {
    const n = R.int(3, 6), d = R.int(1, n), nums = Array.from({ length: n }, (_, i) => i + 1);
    nums.push(d);
    for (let k = R.int(0, 1); k > 0; k--) { const i = R.int(0, n); if (nums[i] !== d && nums.filter((x) => x === nums[i]).length === 1) nums[i] = d; }
    const out = R.shuffle(nums);
    return { args: { nums: out }, note: `nums = ${R.fmt(out)}`, py: `Solution().findDuplicate(${R.py(out)})` };
  },
  295: (R) => {
    const ops = [];
    for (let k = R.int(3, 5); k > 0; k--) {
      ops.push(["add", R.int(1, 20)]);
      if (R.chance(0.7)) ops.push(["find"]);
    }
    if (ops[ops.length - 1][0] !== "find") ops.push(["find"]);
    const txt = ops.map((o) => (o[0] === "add" ? `addNum(${o[1]})` : "findMedian()")).join(" ");
    return { args: { ops }, note: txt, py: `__ops(MedianFinder(), ${R.py(ops)}, {"add": "addNum", "find": "findMedian"})` };
  },
  300: (R) => {
    const nums = R.arr(R.int(5, 9), 0, 12);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().lengthOfLIS(${R.py(nums)})` };
  },
  322: (R) => {
    const coins = R.sorted(R.distinct(R.int(1, 3), 1, 7)), amount = R.int(3, 12);
    return { args: { coins, amount }, note: `coins = ${R.fmt(coins)}, amount = ${amount}`, py: `Solution().coinChange(${R.py(coins)}, ${amount})` };
  },
  347: (R) => {
    const vals = R.distinct(R.int(3, 4), 1, 9), counts = R.shuffle([1, 2, 3, 4]).slice(0, vals.length);
    const nums = R.shuffle(vals.flatMap((v, i) => Array(counts[i]).fill(v))), k = R.int(1, 2);
    return { args: { nums, k }, note: `nums = ${R.fmt(nums)}, k = ${k}`, py: `Solution().topKFrequent(${R.py(nums)}, ${k})`, cmp: "unordered" };
  },
  394: (R) => {
    const atom = () => R.word(R.int(1, 2), "abc");
    const enc = (depth) => {
      const inner = depth > 0 && R.chance(0.5) ? atom() + enc(depth - 1) : atom();
      return `${R.int(2, 3)}[${inner}]`;
    };
    const s = (R.chance(0.4) ? atom() : "") + enc(R.int(0, 1)) + (R.chance(0.5) ? enc(0) : "") + (R.chance(0.3) ? atom() : "");
    return { args: { s }, note: `s = "${s}"`, py: `Solution().decodeString("${s}")` };
  },
  416: (R) => {
    const nums = R.arr(R.int(3, 6), 1, 8);
    return { args: { nums }, note: `nums = ${R.fmt(nums)}`, py: `Solution().canPartition(${R.py(nums)})` };
  },
  437: (R) => {
    const t = R.tree(R.int(4, 8), () => R.int(-3, 6)), target = R.int(-2, 8);
    return { args: { t: t.heap, target }, note: `root = ${R.fmt(t.lc)}, targetSum = ${target}`, py: `Solution().pathSum(T(${R.py(t.lc)}), ${target})` };
  },
  438: (R) => {
    const s = R.word(R.int(8, 12), "abc"), p = R.word(R.int(2, 3), "abc");
    return { args: { s, p }, note: `s = "${s}", p = "${p}"`, py: `Solution().findAnagrams("${s}", "${p}")` };
  },
  543: (R) => {
    const t = R.tree(R.int(3, 9), () => R.int(1, 9));
    return { args: { t: t.heap }, note: `root = ${R.fmt(t.lc)}`, py: `Solution().diameterOfBinaryTree(T(${R.py(t.lc)}))` };
  },
  560: (R) => {
    const nums = R.arr(R.int(4, 7), -2, 4), k = R.int(-1, 6);
    return { args: { nums, k }, note: `nums = ${R.fmt(nums)}, k = ${k}`, py: `Solution().subarraySum(${R.py(nums)}, ${k})` };
  },
  739: (R) => {
    const t = R.arr(R.int(5, 8), 60, 80);
    return { args: { t }, note: `temperatures = ${R.fmt(t)}`, py: `Solution().dailyTemperatures(${R.py(t)})` };
  },
  763: (R) => {
    const s = R.word(R.int(8, 14), R.pick(["abcdef", "abcdefgh"]));
    return { args: { s }, note: `s = "${s}"`, py: `Solution().partitionLabels("${s}")` };
  },
  994: (R) => {
    const r = R.int(2, 4), c = R.int(2, 4);
    const grid = Array.from({ length: r }, () => Array.from({ length: c }, () => (R.chance(0.2) ? 0 : 1)));
    for (let k = R.int(1, 2); k > 0; k--) grid[R.int(0, r - 1)][R.int(0, c - 1)] = 2;
    return { args: { grid }, note: `grid = ${R.fmt(grid)}`, py: `Solution().orangesRotting(${R.py(grid)})` };
  },
  1143: (R) => {
    const t1 = R.word(R.int(3, 6), "abcde"), t2 = R.word(R.int(3, 6), "abcde");
    return { args: { t1, t2 }, note: `text1 = "${t1}", text2 = "${t2}"`, py: `Solution().longestCommonSubsequence("${t1}", "${t2}")` };
  },
};

/** 导出成一段独立的函数源码（不依赖外部变量），嵌进图解页面和网站数据：调用后返回 { args, note } */
function randomSource(id) {
  const g = GEN[id];
  if (!g) return null;
  return `() => { const R = (${makeR.toString()})(); const r = (${g.toString()})(R); return { args: r.args, note: r.note }; }`;
}

module.exports = { makeR, GEN, randomSource };
