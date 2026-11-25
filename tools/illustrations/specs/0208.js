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
  legend: [["a", "当前节点"], ["e", "走过的路径"], ["c", "单词结尾 (is_end)"], ["w", "新建节点 / 查找失败"]],
  presets: [
    { label: "示例", args: { ops: [["insert", "apple"], ["search", "apple"], ["search", "app"], ["startsWith", "app"], ["insert", "app"], ["search", "app"]] }, note: "insert apple, search apple, search app, startsWith app, insert app, search app", expect: [null, true, false, true, null, true] },
    { label: "分叉", args: { ops: [["insert", "car"], ["insert", "cat"], ["insert", "do"], ["startsWith", "ca"], ["search", "ca"], ["search", "cat"]] }, note: "insert car, cat, do 后查询", expect: [null, null, null, true, false, true] },
  ],
  build(a, snap) {
    const T = [{ ch: "", kids: {}, end: false, depth: 0 }], out = [];
    let wordCount = 0;
    const name = (o) => `${o[0]}("${o[1]}")`;
    const view = (opIdx, opts = {}) => {
      const pos = [], edges = [];
      let col = 0;
      const place = (id) => {
        const ks = Object.keys(T[id].kids).sort();
        if (!ks.length) { pos[id] = [col++, T[id].depth]; return; }
        ks.forEach((k) => place(T[id].kids[k]));
        const xs = ks.map((k) => pos[T[id].kids[k]][0]);
        pos[id] = [(Math.min(...xs) + Math.max(...xs)) / 2, T[id].depth];
      };
      place(0);
      T.forEach((nd, u) => {
        for (const k of Object.keys(nd.kids).sort()) edges.push([u, nd.kids[k]]);
      });
      const path = opts.path || [];
      const curNode = path.length ? path[path.length - 1] : -1;
      const fresh = opts.fresh ?? -1;
      const views = [
        { t: "chips", label: "操作序列", items: a.ops.map((o, t) => ({ v: name(o), cls: t === opIdx ? "a" : t < opIdx ? "d" : "" })) },
      ];
      if (opts.word !== undefined) {
        views.push({
          t: "array",
          label: `当前字符串 "${opts.word}"`,
          items: [...opts.word].map((ch, k) => ({
            v: ch,
            cls: k === opts.failChar ? "w" : k === opts.charIdx ? "a" : k < opts.charIdx ? "e" : "",
          })),
          ptrs: opts.charIdx < opts.word.length ? { c: opts.charIdx } : {},
        });
      }
      views.push(
        {
          t: "net",
          label: "前缀树（绿色 / end 表示有单词在这里结束）",
          directed: true,
          pos,
          nodes: T.map((nd, idx) => ({
            v: idx === 0 ? "根" : nd.ch,
            cls: idx === fresh || (idx === curNode && (opts.warnEnd || opts.failChar !== undefined))
              ? "w"
              : idx === curNode
                ? (opts.markEnd ? "c" : "a")
                : path.includes(idx)
                  ? "e"
                  : nd.end
                    ? "c"
                    : "",
          })),
          edges: edges.map(([u, v]) => {
            const isCurEdge = opts.edge && opts.edge[0] === u && opts.edge[1] === v;
            const pIdx = path.indexOf(u);
            const onPath = pIdx >= 0 && path[pIdx + 1] === v;
            return [u, v, isCurEdge ? "on draw" : onPath ? "on" : ""];
          }),
          badges: T.map((nd) => (nd.end ? "end" : "")),
        },
        {
          t: "chips",
          label: "输出",
          items: out.map((v, k) => ({
            v: v === null ? "null" : String(v),
            cls: k === out.length - 1 && opts.justOut ? (v === false ? "w" : v === true ? "c" : "d") : "",
          })),
          empty: "还没有",
        },
      );
      return views;
    };
    snap("初始化", "创建一个空的前缀树，只有一个根节点 root。", view(-1), {
      at: "init",
      facts: [["操作", "Trie()"], ["节点数", 1], ["已存单词", 0]],
    });
    a.ops.forEach((o, i) => {
      const [op, w] = o;
      const path = [0];
      let node = 0;
      if (op === "insert") {
        for (let k = 0; k < w.length; k++) {
          const c = w[k];
          const prevNodes = T.length;
          const made = !(c in T[node].kids);
          if (made) {
            T.push({ ch: c, kids: {}, end: false, depth: T[node].depth + 1 });
            T[node].kids[c] = T.length - 1;
          }
          const parent = node;
          node = T[node].kids[c];
          path.push(node);
          snap(
            made ? `新建 '${c}'` : `沿着 '${c}' 走`,
            made
              ? `当前节点没有 '${c}' 这条边，新建子节点 '${c}' 并走过去。`
              : `'${c}' 子节点已经存在，直接走过去（共享公共前缀）。`,
            view(i, { word: w, charIdx: k, path: path.slice(), edge: [parent, node], fresh: made ? node : -1 }),
            {
              at: "insert",
              facts: [
                ["操作", name(o)],
                ["当前字符", `'${c}' (${k + 1}/${w.length})`],
                ["节点数", T.length, prevNodes],
              ],
            },
          );
        }
        const prevEnd = T[node].end;
        const prevWords = wordCount;
        T[node].end = true;
        if (!prevEnd) wordCount++;
        out.push(null);
        snap(
          "标记 is_end",
          `"${w}" 的字母走完了，把当前节点的 <code>is_end</code> 设为 True，表示一个单词在这里结束。`,
          view(i, { word: w, charIdx: w.length, path: path.slice(), markEnd: true, justOut: true }),
          {
            at: "insert",
            facts: [
              ["操作", name(o)],
              ["is_end", "True", prevEnd ? "True" : "False"],
              ["已存单词", wordCount, prevWords],
            ],
          },
        );
      } else {
        let ok = true;
        for (let k = 0; k < w.length; k++) {
          const c = w[k];
          if (!(c in T[node].kids)) {
            ok = false;
            out.push(false);
            snap(
              "路断了",
              `走到第 ${k + 1} 个字母 '${c}' 时没有对应的子节点，路断了，直接返回 <b>false</b>。`,
              view(i, { word: w, charIdx: k, failChar: k, path: path.slice(), justOut: true }),
              {
                at: "find",
                facts: [
                  ["操作", name(o)],
                  ["字符", `'${c}' 缺失`],
                  ["返回", "false"],
                ],
              },
            );
            break;
          }
          const parent = node;
          node = T[node].kids[c];
          path.push(node);
          snap(
            `沿着 '${c}' 走`,
            `找到子节点 '${c}'，继续往下走到第 ${k + 1} 个字母。`,
            view(i, { word: w, charIdx: k, path: path.slice(), edge: [parent, node] }),
            {
              at: "find",
              facts: [
                ["操作", name(o)],
                ["当前字符", `'${c}' (${k + 1}/${w.length})`],
                ["节点数", T.length],
              ],
            },
          );
        }
        if (ok) {
          if (op === "search") {
            const res = T[node].end;
            out.push(res);
            snap(
              name(o),
              res
                ? `走到了 "${w}" 的节点，而且它有结尾标记（is_end = True），返回 <b>true</b>。`
                : `能走到 "${w}" 的节点，但它没有结尾标记（is_end = False，只是别的单词的前缀），返回 <b>false</b>。`,
              view(i, { word: w, charIdx: w.length, path: path.slice(), warnEnd: !res, markEnd: res, justOut: true }),
              {
                at: "search",
                facts: [
                  ["操作", name(o)],
                  ["is_end", res ? "True" : "False"],
                  ["返回", String(res)],
                ],
              },
            );
          } else {
            out.push(true);
            snap(
              name(o),
              `成功走完了 "${w}"，说明前缀树里有单词以它开头（无需检查 is_end），返回 <b>true</b>。`,
              view(i, { word: w, charIdx: w.length, path: path.slice(), justOut: true }),
              {
                at: "starts",
                facts: [
                  ["操作", name(o)],
                  ["前缀匹配", "成功"],
                  ["返回", "true"],
                ],
              },
            );
          }
        }
      }
    });
    snap("完成", `所有操作完成，输出是 [${out.map((v) => (v === null ? "null" : v)).join(", ")}]。`, view(a.ops.length), {
      at: [],
      kind: "ok",
      ans: out.slice(),
      facts: [["节点数", T.length], ["已存单词", wordCount], ["操作数", a.ops.length]],
    });
  },
  points: [
    { t: "结尾标记不能省", body: "没有 is_end，就分不清 app 是插入过的单词，还是 apple 的前缀。" },
    { t: "公共前缀只存一份", body: "car 和 cat 共用 c → a 两个节点，这也是它叫前缀树的原因。" },
    { t: "复杂度", body: "每个操作 O(L)，L 是单词长度。空间是所有插入单词的字母总数乘以节点大小。" },
  ],
};
