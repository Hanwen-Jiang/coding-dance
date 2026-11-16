module.exports = {
  slug: "hash-table", name: "哈希表与集合", kind: "ds", order: 2,
  lede: "哈希表把「键」算成一个位置，插入、查找、删除平均都是 O(1)。需要「记下见过什么」「数一数出现几次」「按某个特征分组」时，第一个想到的就该是它。集合是只有键、没有值的哈希表。",
  related: [1, 49, 128, 560, 3, 438, 41],
  sections: [{
    key: "count", t: "哈希表：计数",
    body: [
      "数每个字符出现了几次：键是字符，值是次数。遇到一个字符就把它的次数加一，没见过的字符当作 0。",
      "数完以后再按原来的顺序扫一遍，第一个次数是 1 的字符就是答案。两遍都是 O(n)。很多题都是这个套路：<b>先用哈希表把信息记下来，再查</b>。",
      "各语言的哈希表：Python <code>dict</code> / <code>Counter</code>，Java <code>HashMap</code>，C++ <code>unordered_map</code>，Go <code>map</code>，JavaScript / TypeScript <code>Map</code>。",
    ],
    points: [
      { t: "键只有小写字母时", body: "可以用长度 26 的数组代替哈希表，<code>ch - 'a'</code> 就是下标，更快也更省空间。" },
      { t: "Java 的 getOrDefault / merge", body: "<code>cnt.merge(ch, 1, Integer::sum)</code> 一行就能把次数加一。" },
    ],
    codes: [{ t: "两遍扫描", key: "count", code: `
class Solution:
    def firstUniqChar(self, s: str) -> int:
        cnt = {}                                # 字符 -> 出现次数 #@init
        for ch in s:                            #@count
            cnt[ch] = cnt.get(ch, 0) + 1        # 没见过的当作 0 #@count
        for i, ch in enumerate(s):              # 再按原来的顺序找 #@find
            if cnt[ch] == 1:                    #@find
                return i                        #@hit
        return -1                               #@miss
` }, { t: "简洁写法：Counter", key: "count_counter", kind: "elegant", code: `
class Solution:
    def firstUniqChar(self, s: str) -> int:
        cnt = Counter(s)
        return next((i for i, ch in enumerate(s) if cnt[ch] == 1), -1)
` }],
    sig: { fn: "firstUniqChar", params: ["string"], ret: "int" },
    call: (a) => [a.s],
    cases: [["leetcode"], ["loveleetcode"], ["aabb"], ["z"]],
    gen: (R) => { const s = R.word(R.int(4, 9), R.pick(["abc", "abcd", "abcde"])); return { args: { s }, note: `s = "${s}"` }; },
    demo: {
      legend: [["a", "正在看的字符"], ["c", "只出现一次"], ["d", "出现不止一次"]],
      presets: [
        { label: "示例 1", args: { s: "loveleetcode" }, note: 's = "loveleetcode"', expect: 2 },
        { label: "没有", args: { s: "aabb" }, note: 's = "aabb"', expect: -1 },
      ],
      build(a, snap) {
        const s = [...a.s], cnt = new Map();
        let at = -1, phase = 1;
        const view = () => [
          { t: "array", label: "s", items: s.map((ch, i) => ({ v: ch, cls: i === at ? "a" : phase === 2 && i < at ? "d" : "" })) },
          { t: "chips", label: "cnt（字符: 次数）", items: [...cnt].map(([k, v]) => ({ v: `${k}: ${v}`, cls: phase === 2 ? (v === 1 ? "c" : "d") : at >= 0 && k === s[at] ? "a" : "" })), empty: "空" },
        ];
        snap("开始", "cnt 是一个空的哈希表。", view(), { at: "init" });
        for (let i = 0; i < s.length; i++) {
          at = i; const had = cnt.get(s[i]) || 0; cnt.set(s[i], had + 1);
          snap("计数", `s[${i}] = '${s[i]}'，${had ? `之前见过 ${had} 次` : "第一次见"}，次数变成 ${had + 1}。`, view(), { at: "count" });
        }
        phase = 2;
        for (let i = 0; i < s.length; i++) {
          at = i;
          if (cnt.get(s[i]) === 1) { snap("找到了", `s[${i}] = '${s[i]}' 只出现了 1 次，返回 ${i}。`, view(), { at: ["find", "hit"], kind: "ok", ans: i }); return; }
          snap("再扫一遍", `s[${i}] = '${s[i]}' 出现了 ${cnt.get(s[i])} 次，不是。`, view(), { at: "find" });
        }
        at = s.length;
        snap("没有", "每个字符都出现了不止一次，返回 -1。", view(), { at: "miss", kind: "ok", ans: -1 });
      },
    },
  }, {
    key: "set", t: "集合：查在不在",
    body: [
      "只关心「有没有」、不关心「有几个」时用集合。把 nums1 放进集合，再看 nums2 的每个数在不在里面，每次判断是 O(1)；如果在列表里找，每次都要 O(n)。",
      "答案要去重，所以也放进集合。「两数之和」（1）是同一个思路的变形：一边遍历，一边在哈希表里找「之前有没有出现过 target - x」。",
    ],
    points: [
      { t: "集合是无序的", body: "从集合转成列表时顺序不确定，题目说「可以不考虑输出结果的顺序」才能这样做。" },
      { t: "各语言的集合", body: "Python <code>set</code>，Java <code>HashSet</code>，C++ <code>unordered_set</code>，Go 用 <code>map[int]bool</code>，JavaScript / TypeScript <code>Set</code>。" },
    ],
    codes: [{ t: "两个集合", key: "set", code: `
class Solution:
    def intersection(self, nums1: List[int], nums2: List[int]) -> List[int]:
        seen = set(nums1)                       # 查一个数在不在：O(1) #@init
        res = set()                             # 答案也用集合，自动去重 #@init
        for x in nums2:                         #@loop
            if x in seen:                       #@hit
                res.add(x)                      #@hit
        return list(res)                        #@done
` }, { t: "简洁写法：集合求交集", key: "set_and", kind: "elegant", code: `
class Solution:
    def intersection(self, nums1: List[int], nums2: List[int]) -> List[int]:
        return list(set(nums1) & set(nums2))
` }],
    sig: { fn: "intersection", params: ["int[]", "int[]"], ret: "int[]", cmp: "unordered" },
    call: (a) => [a.nums1, a.nums2],
    cases: [[[1, 2, 2, 1], [2, 2]], [[4, 9, 5], [9, 4, 9, 8, 4]], [[1], [2]]],
    gen: (R) => { const nums1 = R.arr(R.int(2, 6), 0, 8), nums2 = R.arr(R.int(2, 6), 0, 8); return { args: { nums1, nums2 }, note: `nums1 = ${R.fmt(nums1)}, nums2 = ${R.fmt(nums2)}` }; },
    demo: {
      legend: [["a", "正在查的数"], ["c", "在集合里"], ["d", "不在"]],
      presets: [{ label: "示例 2", args: { nums1: [4, 9, 5], nums2: [9, 4, 9, 8, 4] }, note: "nums1 = [4,9,5], nums2 = [9,4,9,8,4]", expect: [9, 4] }],
      build(a, snap) {
        const seen = [...new Set(a.nums1)], res = [], st = a.nums2.map(() => "");
        let at = -1;
        const view = () => [
          { t: "chips", label: "seen = set(nums1)", items: seen.map((x) => ({ v: x, cls: at >= 0 && a.nums2[at] === x ? "c" : "" })) },
          { t: "array", label: "nums2", items: a.nums2.map((x, i) => ({ v: x, cls: i === at ? "a" : st[i] })) },
          { t: "chips", label: "res（集合）", items: res.slice(), empty: "空" },
        ];
        snap("开始", `把 nums1 放进集合：{${seen.join(", ")}}，重复的 ${a.nums1.length - seen.length ? "自动去掉了" : "没有"}。`, view(), { at: "init" });
        a.nums2.forEach((x, i) => {
          at = i;
          if (seen.includes(x)) {
            const dup = res.includes(x);
            if (!dup) res.push(x);
            st[i] = "c";
            snap("在", `${x} 在 seen 里，放进 res${dup ? "。res 里已经有了，集合不会重复存" : ""}。`, view(), { at: ["loop", "hit"] });
          } else {
            st[i] = "d";
            snap("不在", `${x} 不在 seen 里，跳过。`, view(), { at: ["loop", "hit"] });
          }
        });
        at = -1;
        snap("完成", `交集是 [${res.join(", ")}]。`, view(), { at: "done", kind: "ok", ans: res.slice() });
      },
    },
  }],
};
