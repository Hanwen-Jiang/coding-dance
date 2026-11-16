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
  legend: [["a", "当前的词"], ["d", "已分组"], ["e", "刚放进去"]],
  presets: [
    { label: "示例 1", args: { strs: ["eat", "tea", "tan", "ate", "nat", "bat"] }, note: 'strs = ["eat","tea","tan","ate","nat","bat"]', expect: [["eat", "tea", "ate"], ["tan", "nat"], ["bat"]] },
    { label: "更长的词", args: { strs: ["listen", "silent", "enlist", "google", "gogole", "cat"] }, note: 'strs = ["listen","silent","enlist","google","gogole","cat"]', expect: [["listen", "silent", "enlist"], ["google", "gogole"], ["cat"]] },
  ],
  build(a, snap) {
    const { strs } = a, groups = new Map();
    const view = (i, key) => [
      { t: "chips", label: "strs", items: strs.map((v, j) => ({ v, cls: j === i ? "a" : j < i ? "d" : "" })) },
      ...[...groups].map(([k, g]) => ({ t: "chips", label: `键 "${k}"`, items: g.map((v, j) => ({ v, cls: k === key && j === g.length - 1 ? "e" : "" })) })),
    ];
    snap("开始", "逐个处理每个词：把字母排序得到键，再放进键对应的那一组。", view(-1), { at: "init" });
    strs.forEach((s, i) => {
      const key = [...s].sort().join("");
      const isNew = !groups.has(key);
      if (isNew) groups.set(key, []);
      groups.get(key).push(s);
      snap(isNew ? "新的一组" : "放进已有的组", `"${s}" 排序后是 <b>"${key}"</b>。` + (isNew ? "哈希表里还没有这个键，新建一组。" : `这个键已经有了，说明它和 "${groups.get(key)[0]}" 是异位词，放进同一组。`), view(i, key), { at: ["key", "add"], facts: [["当前键", key], ["组数", groups.size]] });
    });
    snap("完成", `所有词处理完，一共 <b>${groups.size}</b> 组。哈希表的所有值就是答案。`, view(strs.length), { at: "done", kind: "ok", ans: [...groups.values()], facts: [["组数", groups.size]] });
  },
  points: [
    { t: "键必须能哈希", body: "Python 里列表不能做字典的键，所以排序后要用 <code>\"\".join(...)</code> 变回字符串，或者用元组。" },
    { t: "defaultdict 省一步", body: "<code>defaultdict(list)</code> 在键不存在时自动建一个空列表，不用先判断。" },
    { t: "复杂度", body: "n 个词、最长 L：排序做键是 O(n · L log L)，计数做键是 O(n · L)。" },
  ],
};
