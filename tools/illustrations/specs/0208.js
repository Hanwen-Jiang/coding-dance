module.exports = {
  id: 208, name: "实现 Trie (前缀树)", title: "实现 Trie (前缀树)图解", level: "中等", topic: "图论",
  h1: "前缀树，公共前缀只存一份",
  lede: "每个节点代表一个前缀，从它往下的每条边是一个字母。插入单词就是沿着字母一路往下走，没有路就新建；走到最后一个字母的节点做个「单词结尾」标记。search 要求走得到并且有标记，startsWith 只要求走得到。",
  hints: [
    { t: "节点里存什么", body: ["<code>children</code>：字母 → 子节点。只有小写字母时也可以用长度 26 的数组。", "<code>is_end</code>：是否有单词在这里结束。"] },
    { t: "insert", body: ["从根出发，对单词的每个字母：没有这个子节点就新建，然后走下去。最后把所在节点的 <code>is_end</code> 设为 True。"] },
    { t: "search 和 startsWith 的区别", body: ["两者都是沿着字母往下走，中途没路就返回 False。", "走完后，search 还要求 <code>is_end</code> 为 True；startsWith 不需要。插入 apple 后，search(\"app\") 是 False，startsWith(\"app\") 是 True。"] },
  ],
  codes: [{ t: "标准解法：节点类 + 26 叉数组", code: `
class TrieNode:
    def __init__(self):
        self.children = [None] * 26
        self.is_end = False

class Trie:
    def __init__(self):
        self.root = TrieNode()                  #@init

    def insert(self, word: str) -> None:
        node = self.root                        #@insert
        for c in word:                          #@insert
            i = ord(c) - ord("a")               #@insert
            if not node.children[i]:            #@insert
                node.children[i] = TrieNode()   # 没有路就新建 #@insert
            node = node.children[i]             #@insert
        node.is_end = True                      # 标记单词结尾 #@insert

    def _find(self, s: str):
        node = self.root                        #@find
        for c in s:                             #@find
            node = node.children[ord(c) - ord("a")]   #@find
            if not node:                        #@find
                return None                     #@find
        return node                             #@find

    def search(self, word: str) -> bool:
        node = self._find(word)                 #@search
        return node is not None and node.is_end #@search

    def startsWith(self, prefix: str) -> bool:
        return self._find(prefix) is not None   #@starts
` }, { t: "简洁写法：嵌套字典", kind: "elegant", note: "每个节点就是一个 dict，键 \"#\" 表示有单词在这里结束。", code: `
class Trie:
    def __init__(self):
        self.root = {}

    def insert(self, word: str) -> None:
        node = self.root
        for c in word:
            node = node.setdefault(c, {})
        node["#"] = True

    def _walk(self, s: str):
        node = self.root
        for c in s:
            node = node.get(c)
            if node is None:
                return None
        return node

    def search(self, word: str) -> bool:
        return "#" in (self._walk(word) or {})

    def startsWith(self, prefix: str) -> bool:
        return self._walk(prefix) is not None
` }],
  sig: { cls: "Trie", ctor: [], methods: { insert: [["string"], "void"], search: [["string"], "bool"], startsWith: [["string"], "bool"] } },
  call: (a) => [["Trie", ...a.ops.map((o) => o[0])], [[], ...a.ops.map((o) => [o[1]])]],
  cases: [[["Trie", "insert", "search", "startsWith", "search"], [[], ["a"], ["a"], ["b"], ["aa"]]], [["Trie", "search", "startsWith", "insert", "startsWith"], [[], ["z"], ["z"], ["zz"], ["z"]]]],
  pytest: `
t = Trie()
t.insert("apple")
assert t.search("apple") is True
assert t.search("app") is False
assert t.startsWith("app") is True
t.insert("app")
assert t.search("app") is True
assert t.startsWith("b") is False
t.insert("banana")
assert t.startsWith("ban") is True and t.search("ban") is False
`,
  legend: [["a", "正在执行的操作"]],
  presets: [
    { label: "示例", args: { ops: [["insert", "apple"], ["search", "apple"], ["search", "app"], ["startsWith", "app"], ["insert", "app"], ["search", "app"]] }, note: "insert apple, search apple, search app, startsWith app, insert app, search app", expect: [null, true, false, true, null, true] },
    { label: "分叉", args: { ops: [["insert", "car"], ["insert", "cat"], ["insert", "do"], ["startsWith", "ca"], ["search", "ca"], ["search", "cat"]] }, note: "insert car, cat, do 后查询", expect: [null, null, null, true, false, true] },
  ],
  build(a, snap) {
    const root = { ch: {}, end: false }, out = [];
    const render = (hl) => {
      const lines = ["(根)"];
      const walk = (node, prefix, indent) => {
        const keys = Object.keys(node.ch).sort();
        keys.forEach((k, idx) => {
          const last = idx === keys.length - 1, word = prefix + k, child = node.ch[k];
          const on = hl && hl.startsWith(word);
          const label = (on ? `<b style="color:var(--accent)">${k}</b>` : k) + (child.end ? " ●" : "");
          lines.push(indent + (last ? "└─ " : "├─ ") + label);
          walk(child, word, indent + (last ? "   " : "│  "));
        });
      };
      walk(root, "", "");
      return `<pre class="code">${lines.join("\n")}</pre>`;
    };
    const name = (o) => `${o[0]}("${o[1]}")`;
    const view = (i, hl) => [
      { t: "chips", label: "操作", items: a.ops.map((o, t) => ({ v: name(o), cls: t === i ? "a" : t < i ? "d" : "" })) },
      { t: "note", label: "前缀树（● 表示有单词在这里结束，蓝色是这次走过的路径）", html: render(hl) },
      { t: "chips", label: "输出", items: out.map((v) => (v === null ? "null" : String(v))), empty: "还没有" },
    ];
    snap("开始", "只有一个空的根节点。", view(-1, ""), { at: "init" });
    a.ops.forEach((o, i) => {
      const [op, w] = o; let node = root, msg;
      if (op === "insert") {
        const made = [];
        for (const c of w) { if (!node.ch[c]) { node.ch[c] = { ch: {}, end: false }; made.push(c); } node = node.ch[c]; }
        node.end = true; out.push(null);
        msg = `沿着 ${w.split("").join(" → ")} 往下走，${made.length ? `新建了 ${made.join("、")} 这几个节点` : "所有节点都已经存在"}，在最后一个节点打上结尾标记。`;
      } else {
        let k = 0; for (; k < w.length && node; k++) node = node.ch[w[k]];
        const found = !!node, res = op === "search" ? found && node.end : found; out.push(res);
        msg = !found ? `走到第 ${k} 个字母 '${w[k - 1]}' 时没有路了，返回 <b>false</b>。` : op === "search" ? `能走到 "${w}" 的节点，${node.end ? "它有结尾标记" : "但它没有结尾标记，只是别的单词的前缀"}，返回 <b>${res}</b>。` : `能走到 "${w}" 的节点，说明有单词以它开头，返回 <b>true</b>。`;
      }
      snap(name(o), msg, view(i, w), { at: op === "insert" ? "insert" : op === "search" ? ["search", "find"] : ["starts", "find"] });
    });
    snap("完成", `输出是 [${out.map((v) => (v === null ? "null" : v)).join(", ")}]。`, view(a.ops.length, ""), { at: [], kind: "ok", ans: out.slice() });
  },
  points: [
    { t: "结尾标记不能省", body: "没有 is_end，就分不清 app 是插入过的单词，还是 apple 的前缀。" },
    { t: "公共前缀只存一份", body: "car 和 cat 共用 c → a 两个节点，这也是它叫前缀树的原因。" },
    { t: "复杂度", body: "每个操作 O(L)，L 是单词长度。空间是所有插入单词的字母总数乘以节点大小。" },
  ],
};
