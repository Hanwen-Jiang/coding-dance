module.exports = {
  id: 49, name: "字母异位词分组", title: "字母异位词分组图解", level: "中等", topic: "哈希",
  h1: "字母异位词分组，给每个词算一个身份证",
  lede: "字母异位词的字母完全一样，只是顺序不同。只要给每个词算出一个和顺序无关的标识，标识相同的就是一组。",
  hints: [
    { t: "异位词有什么共同点", body: ["<code>eat</code>、<code>tea</code>、<code>ate</code> 把字母排序后都是 <code>aet</code>。", "排序后的结果就是这一组词共同的标识。"] },
    { t: "用哈希表分组", body: ["键是排序后的字符串，值是一个列表，装所有标识相同的原词。", "遍历每个词，算出键，放进对应的列表。"] },
    { t: "另一种标识", body: ["也可以数 26 个字母各出现几次，用这 26 个数组成的元组做键，这样不用排序，单个词是 <code>O(L)</code>。"] },
  ],
  codes: [{ t: "标准解法：排序后的字符串做键", code: `
class Solution:
    def groupAnagrams(self, strs: List[str]) -> List[List[str]]:
        groups = defaultdict(list)      #@init
        for s in strs:
            key = "".join(sorted(s))    # 异位词排序后相同 #@key
            groups[key].append(s)       #@add
        return list(groups.values())    #@done
` }, { t: "简洁写法：先排序再 groupby", kind: "elegant", note: "按「排好序的字符串」排序后，异位词会挨在一起，groupby 把相邻的同类分成一组。", code: `
from itertools import groupby

class Solution:
    def groupAnagrams(self, strs: List[str]) -> List[List[str]]:
        return [list(g) for _, g in groupby(sorted(strs, key=sorted), key=sorted)]
` }],
  pytest: `
s = Solution()
r = s.groupAnagrams(["eat","tea","tan","ate","nat","bat"])
assert sorted(sorted(g) for g in r) == [["ate","eat","tea"],["bat"],["nat","tan"]]
assert s.groupAnagrams([""]) == [[""]]
assert s.groupAnagrams(["a"]) == [["a"]]
`,
  sig: { fn: "groupAnagrams", params: ["string[]"], ret: "List<List<string>>", cmp: "unordered" },
  call: (a) => [a.strs],
  cases: [[[""]], [["a"]], [["ab", "ba", "abc", "cab", "bca", "x"]]],
  legend: [["a", "当前的词 / 新加入"], ["e", "命中的已有分组"], ["d", "已分组"], ["c", "全部完成"]],
  presets: [
    { label: "示例 1", args: { strs: ["eat", "tea", "tan", "ate", "nat", "bat"] }, note: 'strs = ["eat","tea","tan","ate","nat","bat"]', expect: [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]] },
    { label: "更长的词", args: { strs: ["listen", "silent", "enlist", "google", "gogole", "cat"] }, note: 'strs = ["listen","silent","enlist","google","gogole","cat"]', expect: [["listen", "silent", "enlist"], ["google", "gogole"], ["cat"]] },
  ],
  build(a, snap) {
    const { strs } = a, groups = new Map();
    const view = (i, opts = {}) => [
      {
        t: "chips",
        label: "strs",
        items: strs.map((v, j) => ({ v, cls: opts.done ? "d" : j === i ? "a" : j < i ? "d" : "" })),
      },
      ...[...groups].map(([k, g]) => ({
        t: "chips",
        label: `键 "${k}"`,
        items: g.map((v, j) => ({
          v,
          cls: opts.done ? "c" : k === opts.lookupKey ? "e" : k === opts.addedKey && j === g.length - 1 ? "a" : "",
        })),
      })),
    ];
    let prevWord = "—", prevKey = "—";
    snap("开始", "逐个处理每个词：先把字母排序算出键，再放进键对应的分组。", view(-1), {
      at: "init",
      facts: [["当前词", "—"], ["排序键", "—"], ["组数", 0]],
    });
    strs.forEach((s, i) => {
      const key = [...s].sort().join("");
      const exists = groups.has(key);
      snap(
        "算键并查询",
        `"${s}" 排序后得到键 <b>"${key}"</b>。` + (exists ? `哈希表里已经有 "${key}" 这一组，准备加入。` : `哈希表里还没有 "${key}"，需要新建一组。`),
        view(i, { lookupKey: exists ? key : null }),
        {
          at: "key",
          facts: [["当前词", s, prevWord], ["排序键", key, prevKey], ["组数", groups.size]],
        },
      );
      const prevSize = groups.size;
      if (!exists) groups.set(key, []);
      groups.get(key).push(s);
      snap(
        exists ? "放入已有分组" : "新建分组",
        exists ? `把 "${s}" 放入键 "${key}" 的组里，现在这一组有 ${groups.get(key).length} 个词。` : `为键 "${key}" 新建分组，放入 "${s}"。`,
        view(i, { addedKey: key }),
        {
          at: "add",
          facts: [["当前词", s], ["排序键", key], ["组数", groups.size, prevSize]],
        },
      );
      prevWord = s; prevKey = key;
    });
    snap("完成", `所有词处理完，一共 <b>${groups.size}</b> 组。哈希表的所有值就是答案。`, view(strs.length, { done: true }), {
      at: "done",
      kind: "ok",
      ans: [...groups.values()].map((g) => g.slice()),
      facts: [["当前词", "—", prevWord], ["排序键", "—", prevKey], ["组数", groups.size]],
    });
  },
  points: [
    { t: "键必须能哈希", body: "Python 里列表不能做字典的键，所以排序后要用 <code>\"\".join(...)</code> 变回字符串，或者用元组。" },
    { t: "defaultdict 省一步", body: "<code>defaultdict(list)</code> 在键不存在时自动建一个空列表，不用先判断。" },
    { t: "复杂度", body: "n 个词、最长 L：排序做键是 O(n · L log L)，计数做键是 O(n · L)。" },
  ],
};
