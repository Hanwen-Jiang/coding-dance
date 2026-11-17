module.exports = {
  slug: "sliding-window", name: "滑动窗口", kind: "algo", order: 9,
  lede: "滑动窗口是同向双指针的一种：[left, right] 是一段连续的子数组（子串），右端一格格往右扩，左端在需要时往右收。每个元素最多进窗口一次、出窗口一次，所以是 O(n)。关键是想清楚：窗口里要维护什么，什么时候该收左端。",
  related: [3, 438, 76, 239],
  sections: [{
    key: "variable", t: "不定长窗口：和至少为 target 的最短子数组",
    body: [
      "数都是正数时，窗口越长和越大。右端每进一个数，就看看窗口的和够不够 target：<b>够了</b>就记下长度，然后试着把左端的数扔掉，看还够不够——够就又得到一个更短的，不够就继续扩右端。",
      "为什么左端只往右走、不用回头？以 right 结尾时，最左能到的 left 只会随着 right 增大而往右挪，不会往左退。这就是滑动窗口能做到 O(n) 的原因。",
    ],
    points: [
      { t: "while 不是 if", body: "右端进来一个大数以后，左端可能要连着扔好几个才不够，所以收缩用 while。" },
      { t: "数必须是正的", body: "有负数时「窗口变长和就变大」不成立，滑动窗口就不对了，要用前缀和加别的办法。" },
    ],
    codes: [{ t: "扩右端、收左端", key: "variable", code: `
class Solution:
    def minSubArrayLen(self, target: int, nums: List[int]) -> int:
        left = total = 0                        #@init
        best = len(nums) + 1                    # 比任何窗口都长：表示还没找到 #@init
        for right, x in enumerate(nums):        #@grow
            total += x                          # 右端进一个数 #@grow
            while total >= target:              # 够了：记下长度，再试着缩短 #@shrink
                best = min(best, right - left + 1)  #@shrink
                total -= nums[left]             # 左端出一个数 #@shrink
                left += 1                       #@shrink
        return best if best <= len(nums) else 0     #@done
` }],
    sig: { fn: "minSubArrayLen", params: ["int", "int[]"], ret: "int" },
    call: (a) => [a.target, a.nums],
    cases: [[7, [2, 3, 1, 2, 4, 3]], [4, [1, 4, 4]], [11, [1, 1, 1, 1, 1, 1, 1, 1]], [3, [3]]],
    gen: (R) => { const nums = R.arr(R.int(4, 9), 1, 6), target = R.int(3, 18); return { args: { target, nums }, note: `target = ${target}, nums = ${R.fmt(nums)}` }; },
    demo: {
      legend: [["e", "窗口里的数"], ["a", "刚进窗口 / 刚出窗口"], ["c", "目前最短的窗口"]],
      presets: [{ label: "示例 1", args: { target: 7, nums: [2, 3, 1, 2, 4, 3] }, note: "target = 7, nums = [2,3,1,2,4,3]", expect: 2 }],
      build(a, snap) {
        const A = a.nums, n = A.length, t = a.target;
        let left = 0, total = 0, best = n + 1, bl = -1, br = -2, R = -1, hot = -1;
        const view = () => [{ t: "array", label: "nums", items: A.map((v, i) => ({ v, cls: i === hot ? "a" : i >= left && i <= R ? "e" : i >= bl && i <= br ? "c" : "" })), ptrs: { left: left <= R ? left : null, right: R >= 0 ? R : null } }];
        const facts = () => [["窗口的和", total], ["最短", best > n ? "—" : best]];
        snap("开始", `窗口是空的，和是 0。要找和 &gt;= ${t} 的最短窗口。`, view(), { at: "init", facts: facts() });
        for (let right = 0; right < n; right++) {
          R = right; total += A[right]; hot = right;
          snap("扩右端", `${A[right]} 进窗口，和变成 ${total}${total >= t ? `，&gt;= ${t} 了` : `，还不到 ${t}`}。`, view(), { at: "grow", facts: facts() });
          while (total >= t) {
            if (right - left + 1 < best) { best = right - left + 1; bl = left; br = right; }
            hot = left;
            snap("收左端", `窗口 [${left}, ${right}] 的和 ${total} 够了，长度 ${right - left + 1}，最短是 ${best}。把左端的 ${A[left]} 扔掉试试。`, view(), { at: "shrink", facts: facts() });
            total -= A[left]; left++; hot = -1;
          }
        }
        hot = -1; R = -1; left = 0;
        const ans = best <= n ? best : 0;
        snap("完成", ans ? `最短的窗口长度是 ${ans}。` : `整个数组的和都不到 ${t}，返回 0。`, view(), { at: "done", kind: "ok", ans, facts: facts() });
      },
    },
  }, {
    key: "fixed", t: "定长窗口：长度为 k 的子串里最多的元音",
    body: [
      "窗口长度固定是 k 时更简单：先算第一个窗口，之后每次右移一格，<b>进来一个、出去一个</b>，只更新这两个字符带来的变化，不用重新数整个窗口。",
      "这样每次 O(1)，总共 O(n)；如果每个窗口都重新数一遍是 O(n·k)。",
    ],
    points: [
      { t: "出去的是哪一个", body: "新进来的是 <code>s[i]</code>，出去的是 <code>s[i - k]</code>。" },
      { t: "可以提前结束", body: "数到 k 个元音时已经不可能更多，可以直接返回。" },
    ],
    codes: [{ t: "进一个、出一个", key: "fixed", code: `
class Solution:
    def maxVowels(self, s: str, k: int) -> int:
        vowels = set("aeiou")
        cnt = sum(ch in vowels for ch in s[:k])     # 第一个窗口 #@init
        best = cnt                                  #@init
        for i in range(k, len(s)):                  # 窗口右移一格 #@slide
            cnt += (s[i] in vowels) - (s[i - k] in vowels)  # 进来 s[i]，出去 s[i-k] #@slide
            best = max(best, cnt)                   #@slide
        return best                                 #@done
` }],
    sig: { fn: "maxVowels", params: ["string", "int"], ret: "int" },
    call: (a) => [a.s, a.k],
    cases: [["abciiidef", 3], ["aeiou", 2], ["leetcode", 3], ["rhythms", 4], ["a", 1]],
    gen: (R) => { const s = R.word(R.int(5, 10), "abeiot"), k = R.int(1, s.length); return { args: { s, k }, note: `s = "${s}", k = ${k}` }; },
    demo: {
      legend: [["e", "窗口"], ["a", "刚进来的字符"], ["d", "刚出去的字符"], ["g", "元音"]],
      presets: [{ label: "示例 1", args: { s: "abciiidef", k: 3 }, note: 's = "abciiidef", k = 3', expect: 3 }],
      build(a, snap) {
        const s = [...a.s], k = a.k, V = "aeiou";
        let lo = 0, hi = k - 1, inn = -1, out = -1, cnt = 0, best = 0;
        const view = () => [{ t: "array", label: "s（窗口里紫底的是元音）", items: s.map((c, i) => ({ v: c, cls: i === inn ? "a" : i === out ? "d" : i >= lo && i <= hi ? (V.includes(c) ? "g" : "e") : "" })) }];
        for (let i = 0; i < k; i++) if (V.includes(s[i])) cnt++;
        best = cnt;
        snap("第一个窗口", `s[0..${k - 1}] 里有 ${cnt} 个元音。`, view(), { at: "init", facts: [["窗口里的元音", cnt], ["最多", best]] });
        for (let i = k; i < s.length; i++) {
          const add = V.includes(s[i]) ? 1 : 0, del = V.includes(s[i - k]) ? 1 : 0;
          cnt += add - del; best = Math.max(best, cnt); lo = i - k + 1; hi = i; inn = i; out = i - k;
          snap("右移一格", `进来 '${s[i]}'（${add ? "元音 +1" : "不是元音"}），出去 '${s[i - k]}'（${del ? "元音 −1" : "不是元音"}）。窗口里有 ${cnt} 个元音，最多是 ${best}。`, view(), { at: "slide", facts: [["窗口里的元音", cnt], ["最多", best]] });
        }
        inn = out = -1;
        snap("完成", `最多有 ${best} 个元音。`, view(), { at: "done", kind: "ok", ans: best, facts: [["最多", best]] });
      },
    },
  }],
};
