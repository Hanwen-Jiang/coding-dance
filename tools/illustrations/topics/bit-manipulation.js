module.exports = {
  slug: "bit-manipulation", name: "位运算", kind: "algo", order: 13,
  lede: "整数在计算机里是一串二进制位，位运算直接对这些位操作：与 &、或 |、异或 ^、取反 ~、左移 <<、右移 >>。几个常用的小技巧：n & (n − 1) 去掉最低位的 1；x ^ x = 0、x ^ 0 = x，相同的数异或会抵消；i >> 1 是 i 去掉最低位，i & 1 是最低位。",
  related: [136, 78, 169, 287],
  sections: [{
    key: "count", t: "数 1 的个数：n & (n − 1)",
    body: [
      "n − 1 会把 n 最低位的那个 1 变成 0，并把它右边的 0 全变成 1。再和 n 做与运算，右边那些位都变回 0，最低位的 1 也没了——效果就是<b>去掉最低位的 1</b>。",
      "一直做到 n 变成 0，做了几次就有几个 1。循环次数等于 1 的个数，比逐位检查 32 次更快。",
    ],
    points: [
      { t: "判断 2 的幂", body: "<code>n &gt; 0 and n &amp; (n - 1) == 0</code>：2 的幂只有一个 1，去掉以后就是 0。" },
      { t: "最低位的 1 本身", body: "<code>n &amp; -n</code> 得到只保留最低位那个 1 的数（树状数组里的 lowbit）。" },
    ],
    codes: [{ t: "去掉最低位的 1", key: "count", code: `
class Solution:
    def hammingWeight(self, n: int) -> int:
        cnt = 0                                 #@init
        while n:                                #@loop
            n &= n - 1                          # 去掉最低位的 1 #@drop
            cnt += 1                            #@drop
        return cnt                              #@done
` }, { t: "简洁写法：bin().count", key: "count_bin", kind: "elegant", note: "Python 3.10 以后也可以写 <code>n.bit_count()</code>。", code: `
class Solution:
    def hammingWeight(self, n: int) -> int:
        return bin(n).count("1")
` }],
    sig: { fn: "hammingWeight", params: ["int"], ret: "int" },
    call: (a) => [a.n],
    cases: [[11], [128], [2147483645], [1]],
    gen: (R) => { const n = R.int(1, 255); return { args: { n }, note: `n = ${n}` }; },
    demo: {
      legend: [["a", "最低位的 1"], ["e", "n − 1 借位变化"], ["w", "刚被去掉的 1"], ["c", "1"]],
      presets: [{ label: "n = 44", args: { n: 44 }, note: "n = 44（二进制 101100）", expect: 3 }, { label: "n = 11", args: { n: 11 }, note: "n = 11（二进制 1011）", expect: 3 }],
      build(a, snap) {
        let n = a.n, cnt = 0;
        const W = Math.max(4, a.n.toString(2).length);
        const bits = (x) => x.toString(2).padStart(W, "0").split("");
        const bin = (x) => x.toString(2).padStart(W, "0");
        const view = (x, low, opts = {}) => {
          const prevBits = opts.prevX !== undefined ? bits(opts.prevX) : null;
          return [
            {
              t: "array",
              label: `n = ${x}（二进制）`,
              items: bits(x).map((b, i) => ({
                v: b,
                ...(prevBits && prevBits[i] !== b ? { prev: prevBits[i] } : {}),
                cls: prevBits && prevBits[i] !== b ? "w" : low !== null && W - 1 - i === low ? "a" : b === "1" ? "c" : "",
              })),
              labels: bits(x).map((_, i) => W - 1 - i),
              ptrs: low !== null ? { lowbit: W - 1 - low } : {},
            },
            ...(opts.extra || []),
          ];
        };
        snap("开始", `n = ${n}，二进制是 ${n.toString(2)}。`, view(n, null), {
          at: "init",
          facts: [["n", n], ["二进制", bin(n)], ["cnt", 0]],
        });
        while (n) {
          const low = Math.log2(n & -n), m = n - 1;
          const nb = bits(n), mb = bits(m);
          snap("看最低位的 1", `n 的最低位的 1 在第 ${low} 位。n − 1 = ${m}：这个 1 变成 0，它右边的 0 都变成 1。`, view(n, low, {
            extra: [{
              t: "array",
              label: `n − 1 = ${m}（右端低位全部翻转）`,
              items: mb.map((b, i) => ({ v: b, cls: nb[i] !== b ? "e" : b === "1" ? "c" : "" })),
              labels: mb.map((_, i) => W - 1 - i),
              ptrs: { "1→0": W - 1 - low },
            }],
          }), {
            at: "loop",
            facts: [["n", n], ["n − 1", m], ["最低位", `第 ${low} 位`], ["cnt", cnt]],
          });
          const oldN = n, oldCnt = cnt;
          n &= m; cnt++;
          snap("n &= n − 1", `与运算以后，第 ${low} 位的 1 被去掉了，n 变成 ${n}（${n.toString(2) || "0"}）。cnt = ${cnt}。`, view(n, null, { prevX: oldN }), {
            at: "drop",
            facts: [["n", n, oldN], ["二进制", bin(n), bin(oldN)], ["cnt", cnt, oldCnt]],
          });
        }
        snap("完成", `n 变成 0 了，一共去掉了 ${cnt} 个 1。`, view(0, null), {
          at: "done",
          kind: "ok",
          ans: cnt,
          facts: [["n", 0], ["1 的个数", cnt]],
        });
      },
    },
  }, {
    key: "xor", t: "异或抵消：丢失的数字",
    body: [
      "0 到 n 这 n + 1 个数里少了一个，其余 n 个放在 nums 里。把 0 到 n 全部异或起来，再和 nums 里的数全部异或：出现了两次的数两两抵消（<code>x ^ x = 0</code>），最后剩下的就是只出现一次的那个——丢失的数。",
      "异或满足交换律和结合律，顺序无所谓，所以可以边遍历边做：下标 i 和 nums[i] 一起异或进去，最后再补上 n。「只出现一次的数字」（136）是同一个道理。",
    ],
    points: [
      { t: "不会溢出", body: "也可以用 0..n 的和减去 nums 的和，但数很大时求和可能溢出，异或不会。" },
      { t: "x ^ 0 = x", body: "所以累积的初值可以是 0，这里直接用 n 当初值，省掉最后补 n 那一步。" },
    ],
    codes: [{ t: "下标和值一起异或", key: "xor", code: `
class Solution:
    def missingNumber(self, nums: List[int]) -> int:
        x = len(nums)                           # 0..n 里的 n 先放进来 #@init
        for i, v in enumerate(nums):            #@loop
            x ^= i ^ v                          # 出现两次的数异或后抵消 #@xor
        return x                                #@done
` }],
    sig: { fn: "missingNumber", params: ["int[]"], ret: "int" },
    call: (a) => [a.nums],
    cases: [[[3, 0, 1]], [[0, 1]], [[9, 6, 4, 2, 3, 5, 7, 0, 1]], [[1]], [[0]]],
    gen: (R) => { const n = R.int(1, 8), miss = R.int(0, n), nums = R.shuffle(Array.from({ length: n + 1 }, (_, i) => i).filter((x) => x !== miss)); return { args: { nums }, note: `nums = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["a", "这一步异或进去的数 / 变化的位"], ["d", "已处理 / 已抵消"], ["c", "答案"]],
      presets: [{ label: "示例 1", args: { nums: [3, 0, 1] }, note: "nums = [3,0,1]", expect: 2 }, { label: "示例 3", args: { nums: [9, 6, 4, 2, 3, 5, 7, 0, 1] }, note: "nums = [9,6,4,2,3,5,7,0,1]", expect: 8 }],
      build(a, snap) {
        const A = a.nums, n = A.length, W = Math.max(3, n.toString(2).length), seen = [];
        let x = n, at = -1;
        const bits = (v) => v.toString(2).padStart(W, "0").split("");
        const bin = (v) => v.toString(2).padStart(W, "0");
        const view = (opts = {}) => {
          const prevBits = opts.prevX !== undefined ? bits(opts.prevX) : null;
          const fin = !!opts.fin;
          return [
            {
              t: "array",
              label: "nums",
              items: A.map((v, i) => ({ v, cls: i === at ? "a" : i < at || fin ? "d" : "" })),
              ptrs: { i: at >= 0 ? at : null },
            },
            {
              t: "array",
              label: `x = ${x}（二进制）`,
              items: bits(x).map((b, k) => ({
                v: b,
                ...(prevBits && prevBits[k] !== b ? { prev: prevBits[k] } : {}),
                cls: fin ? "c" : prevBits && prevBits[k] !== b ? "a" : b === "1" ? "e" : "",
              })),
              labels: bits(x).map((_, i) => W - 1 - i),
            },
            {
              t: "chips",
              label: "已经异或进去的数（成对的会抵消）",
              items: seen.map((v, k) => ({
                v,
                cls: fin ? (v === x ? "c" : "d") : opts.added && k >= seen.length - opts.added ? "a" : "",
              })),
              empty: "空",
            },
          ];
        };
        seen.push(n);
        snap("开始", `x 先取 n = ${n}：0..n 里的 n 先放进来。`, view({ added: 1 }), {
          at: "init",
          facts: [["x", x], ["二进制", bin(x)], ["已异或数", 1]],
        });
        let prevI = "—";
        A.forEach((v, i) => {
          const oldX = x, oldCnt = seen.length;
          at = i; x ^= i ^ v; seen.push(i, v);
          snap("异或", `下标 ${i} 和 nums[${i}] = ${v} 一起异或进去：${oldX} ^ ${i} ^ ${v} = <b>${x}</b>。`, view({ prevX: oldX, added: 2 }), {
            at: ["loop", "xor"],
            facts: [
              ["下标 i", i, prevI],
              ["nums[i]", v],
              x !== oldX ? ["x", x, oldX] : ["x", x],
              bin(x) !== bin(oldX) ? ["二进制", bin(x), bin(oldX)] : ["二进制", bin(x)],
              ["已异或数", seen.length, oldCnt],
            ],
          });
          prevI = i;
        });
        at = -1;
        snap("完成", `0..${n} 每个数作为下标或 n 出现一次；nums 里有的数又作为值出现一次，两两抵消。剩下的 ${x} 只出现了一次，就是丢失的数。`, view({ fin: true }), {
          at: "done",
          kind: "ok",
          ans: x,
          facts: [["丢失的数", x], ["二进制", bin(x)]],
        });
      },
    },
  }, {
    key: "bits-dp", t: "移位：比特位计数",
    body: [
      "求 0 到 n 每个数二进制里 1 的个数。<code>i &gt;&gt; 1</code> 是 i 去掉最低位，它比 i 小，已经算过了；去掉的那一位是 <code>i &amp; 1</code>。所以 <code>ans[i] = ans[i &gt;&gt; 1] + (i &amp; 1)</code>，每个数 O(1)。",
      "这是位运算和动态规划的结合：用更小的数的答案推出大的数的答案。",
    ],
    points: [
      { t: "也可以用 i & (i − 1)", body: "<code>ans[i] = ans[i &amp; (i - 1)] + 1</code>：去掉最低位的 1 以后的数也比 i 小。" },
      { t: "边界", body: "<code>ans[0] = 0</code>，循环从 1 开始。" },
    ],
    codes: [{ t: "ans[i >> 1] + (i & 1)", key: "bits-dp", code: `
class Solution:
    def countBits(self, n: int) -> List[int]:
        ans = [0] * (n + 1)                     # ans[0] = 0 #@init
        for i in range(1, n + 1):               #@loop
            ans[i] = ans[i >> 1] + (i & 1)      # 去掉最低位的数已经算过了，再加上最低位 #@calc
        return ans                              #@done
` }],
    sig: { fn: "countBits", params: ["int"], ret: "int[]" },
    call: (a) => [a.n],
    cases: [[0], [2], [5], [16]],
    gen: (R) => { const n = R.int(1, 12); return { args: { n }, note: `n = ${n}` }; },
    demo: {
      legend: [["a", "正在算的 ans[i]"], ["e", "用到的 ans[i >> 1]"], ["x", "边界"], ["c", "已算好"]],
      presets: [{ label: "n = 10", args: { n: 10 }, note: "n = 10", expect: [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2] }],
      build(a, snap) {
        const n = a.n, ans = new Array(n + 1).fill(null);
        ans[0] = 0;
        const view = (i, opts = {}) => [{
          t: "array",
          label: "ans[i]：i 的二进制里 1 的个数（标签为 十进制（二进制））",
          items: ans.map((v, k) => ({
            v: v ?? "",
            cls: k === i ? "a" : i > 0 && k === i >> 1 ? (k === 0 ? "x e" : "e") : k === 0 ? "x" : v !== null ? "c" : "",
          })),
          labels: ans.map((_, k) => `${k}（${k.toString(2)}）`),
          ptrs: i > 0 ? { "i>>1": i >> 1, i } : {},
          feeds: opts.feeds || [],
        }];
        snap("边界", "ans[0] = 0：0 的二进制里没有 1。", view(-1), {
          at: "init",
          facts: [["n", n], ["ans[0]", 0]],
        });
        let prevI = "—", prevAns = 0;
        for (let i = 1; i <= n; i++) {
          const half = i >> 1, lsb = i & 1;
          ans[i] = ans[half] + lsb;
          const iStr = `${i} (${i.toString(2)})`;
          snap(
            `i = ${i}`,
            `${i} 的二进制是 ${i.toString(2)}。右移一位去掉最低位是 ${half}（${half.toString(2)}），ans[${half}] = ${ans[half]}；最低位 i & 1 = ${lsb}。ans[${i}] = ${ans[half]} + ${lsb} = <b>${ans[i]}</b>。`,
            view(i, { feeds: [{ from: half, to: i, win: true, label: `+${lsb}` }] }),
            {
              at: ["loop", "calc"],
              facts: [
                ["当前 i", iStr, prevI],
                ["右移 i >> 1", `${half} (${half.toString(2)})`],
                ["最低位 i & 1", lsb],
                ans[i] !== prevAns ? ["ans[i]", ans[i], prevAns] : ["ans[i]", ans[i]],
              ],
            },
          );
          prevI = iStr; prevAns = ans[i];
        }
        snap("完成", `ans = [${ans.join(", ")}]。`, view(-1), {
          at: "done",
          kind: "ok",
          ans: ans.slice(),
          facts: [["n", n], ["结果", `[${ans.join(", ")}]`]],
        });
      },
    },
  }],
};
