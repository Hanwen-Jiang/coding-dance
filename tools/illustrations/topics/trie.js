module.exports = {
  slug: "trie", name: "字典树 Trie", kind: "ds", order: 8,
  lede: "字典树把一堆单词按前缀合并成一棵树：从根往下，每条边是一个字符，一条路径就是一个前缀。所有以 \"app\" 开头的单词都挂在同一个节点下面，所以查「有没有这个前缀」「有几个单词以它开头」只要沿着字符走一遍，和单词总数无关。",
  related: [208, 139],
  sections: [{
    key: "basic", t: "插入、查找、数前缀",
    body: [
      "每个节点有一组孩子（字符 → 子节点）。插入单词时从根出发，每个字符走一步，路不存在就新建节点；走完在最后一个节点上记一个「单词结束」的标记。",
      "查找单词也是逐个字符往下走，走不下去就是没有；走完了还要看结束标记——插入过 \"apple\" 不代表有 \"app\" 这个单词。",
      "给每个节点再记一个 <code>pass</code>：插入时经过它的单词数。这样「有几个单词以 prefix 开头」就是走到 prefix 最后一个字符的节点后，读它的 pass。",
    ],
    points: [
      { t: "孩子用数组还是哈希表", body: "只有小写字母时用长度 26 的数组，<code>ch - 'a'</code> 是下标，最快；字符集大或者不确定时用哈希表。Python 习惯用字典。" },
      { t: "复杂度", body: "插入和查找都是 O(单词长度)。空间是所有单词的字符总数（共享前缀的部分只存一次）。" },
    ],
    codes: [{ t: "带计数的字典树", key: "basic", code: `
class TrieNode:
    def __init__(self):
        self.children = {}                  # 字符 -> 子节点
        self.pass_ = 0                      # 经过这个节点的单词数
        self.end = False                    # 有没有单词在这里结束

class Trie:
    def __init__(self):
        self.root = TrieNode()              #@init

    def insert(self, word: str) -> None:
        node = self.root                    #@ins
        for ch in word:                     #@ins
            if ch not in node.children:     # 没有这条路就新建 #@new
                node.children[ch] = TrieNode()  #@new
            node = node.children[ch]        #@walk
            node.pass_ += 1                 #@walk
        node.end = True                     # 标记单词在这里结束 #@mark

    def find(self, s: str) -> Optional[TrieNode]:
        node = self.root
        for ch in s:                        #@find
            if ch not in node.children:     # 走不下去了 #@miss
                return None                 #@miss
            node = node.children[ch]        #@find
        return node

    def search(self, word: str) -> bool:
        node = self.find(word)              #@search
        return node is not None and node.end    # 还要看结束标记 #@search

    def countPrefix(self, prefix: str) -> int:
        node = self.find(prefix)            #@count
        return node.pass_ if node else 0    #@count
` }],
    sig: { cls: "Trie", ctor: [], methods: { insert: [["string"], "void"], search: [["string"], "bool"], countPrefix: [["string"], "int"] } },
    call: (a) => [["Trie", ...a.ops.map((o) => o[0])], [[], ...a.ops.map((o) => o.slice(1))]],
    cases: [[["Trie", "insert", "search", "search", "countPrefix", "insert", "search", "countPrefix"], [[], ["apple"], ["apple"], ["app"], ["app"], ["app"], ["app"], ["ap"]]], [["Trie", "search", "countPrefix"], [[], ["a"], ["a"]]], [["Trie", "insert", "insert", "countPrefix", "search"], [[], ["ab"], ["ab"], ["a"], ["ab"]]]],
    gen: (R) => {
      const ops = [], words = [];
      for (let k = R.int(6, 9); k > 0; k--) {
        const o = words.length < 2 || R.chance(0.45) ? "insert" : R.pick(["search", "countPrefix"]);
        let w = R.chance(0.6) && words.length ? R.pick(words) : R.word(R.int(1, 4), "abc");
        if (o === "countPrefix") w = w.slice(0, R.int(1, w.length));
        if (o === "insert") words.push(w);
        ops.push([o, w]);
      }
      return { args: { ops }, note: ops.map((o) => `${o[0]}("${o[1]}")`).join(" ") };
    },
    demo: {
      legend: [["a", "正在走的节点"], ["w", "刚新建的节点"], ["c", "有单词在这里结束"]],
      presets: [{ label: "示例", args: { ops: [["insert", "app"], ["insert", "apple"], ["insert", "bat"], ["search", "ap"], ["search", "app"], ["countPrefix", "ap"], ["countPrefix", "b"]] }, note: 'insert("app") insert("apple") insert("bat") search("ap") search("app") countPrefix("ap") countPrefix("b")', expect: [null, null, null, null, false, true, 2, 1] }],
      build(a, snap) {
        const T = [{ ch: "", kids: {}, pass: 0, end: false, depth: 0 }], out = [null];
        let path = [], fresh = -1;
        const view = () => {
          const pos = [], order = [];
          let col = 0;
          const place = (id) => {
            const ks = Object.keys(T[id].kids).sort();
            if (!ks.length) { pos[id] = [col++, T[id].depth]; return; }
            ks.forEach((k) => place(T[id].kids[k]));
            const xs = ks.map((k) => pos[T[id].kids[k]][0]);
            pos[id] = [(Math.min(...xs) + Math.max(...xs)) / 2, T[id].depth];
          };
          place(0);
          T.forEach((nd, i) => { for (const k in nd.kids) order.push([i, nd.kids[k]]); });
          return [
            { t: "net", label: "字典树（节点下面是 pass）", directed: true, pos, nodes: T.map((nd, i) => ({ v: i ? nd.ch : "根", cls: i === fresh ? "w" : path.includes(i) ? "a" : nd.end ? "c" : "" })), edges: order.map(([u, v]) => [u, v, path.includes(u) && path.includes(v) ? "on" : ""]), badges: T.map((nd, i) => (i ? nd.pass : "")) },
            { t: "chips", label: "返回值", items: out.map((x) => (x === null ? "null" : String(x))) },
          ];
        };
        snap("开始", "只有一个空的根节点。", view(), { at: "init" });
        for (const [op, w] of a.ops) {
          path = [0]; fresh = -1;
          if (op === "insert") {
            let node = 0;
            snap(`insert("${w}")`, "从根出发，每个字符走一步。", view(), { at: "ins" });
            for (const ch of w) {
              const made = !(ch in T[node].kids);
              if (made) { T.push({ ch, kids: {}, pass: 0, end: false, depth: T[node].depth + 1 }); T[node].kids[ch] = T.length - 1; }
              node = T[node].kids[ch]; T[node].pass++; path.push(node); fresh = made ? node : -1;
              snap(made ? "新建节点" : "沿着走", `${made ? `没有 '${ch}' 这条路，新建一个节点。` : `'${ch}' 这条路已经有了，直接走过去。`}经过它的单词数 pass 变成 ${T[node].pass}。`, view(), { at: made ? ["new", "walk"] : "walk" });
            }
            T[node].end = true; fresh = -1; out.push(null);
            snap("标记结束", `"${w}" 的字符走完了，在最后一个节点上标记「有单词在这里结束」。`, view(), { at: "mark" });
          } else {
            let node = 0, ok = true;
            for (const ch of w) {
              if (!(ch in T[node].kids)) { ok = false; snap("走不下去", `'${ch}' 这条路不存在。`, view(), { at: "miss" }); break; }
              node = T[node].kids[ch]; path.push(node);
              snap("沿着走", `走过 '${ch}'。`, view(), { at: "find" });
            }
            if (op === "search") {
              const r = ok && T[node].end; out.push(r);
              snap(`search("${w}")`, !ok ? "路断了，没有这个单词，返回 false。" : r ? "走完了，最后的节点有结束标记，返回 true。" : "走完了，但最后的节点没有结束标记：它只是别的单词的前缀，返回 false。", view(), { at: "search" });
            } else {
              const r = ok ? T[node].pass : 0; out.push(r);
              snap(`countPrefix("${w}")`, ok ? `走到了 "${w}" 的最后一个字符，它的 pass 是 ${r}：有 ${r} 个单词以 "${w}" 开头。` : "路断了，没有单词以它开头，返回 0。", view(), { at: "count" });
            }
          }
        }
        path = []; fresh = -1;
        snap("完成", "共享前缀的部分只存了一份。", view(), { at: [], kind: "ok", ans: out });
      },
    },
  }, {
    key: "replace", t: "应用：替换成最短的词根",
    body: [
      "给一组词根，把句子里的每个单词换成它最短的词根（没有词根就不换）。把词根都插进字典树，再拿每个单词从根往下走：途中第一次碰到「有词根在这里结束」的节点，走过的这一段就是最短的词根；路断了说明没有词根是它的前缀。",
      "如果一个个词根去比，每个单词要和所有词根比一遍；字典树只沿着单词走一次。",
    ],
    points: [
      { t: "找到就停", body: "要的是<b>最短</b>的词根，所以第一次碰到结束标记就停下，不用再往下走。" },
      { t: "用字典实现", body: "Python 里可以直接用嵌套的字典当节点，用一个特殊的键（比如 <code>\"#\"</code>）表示结束。" },
    ],
    codes: [{ t: "字典树 + 逐词查找", key: "replace", code: `
class Solution:
    def replaceWords(self, dictionary: List[str], sentence: str) -> str:
        root = {}                               # 嵌套的字典当节点，"#" 表示有词根在这里结束 #@build
        for w in dictionary:                    #@build
            node = root                         #@build
            for ch in w:                        #@build
                node = node.setdefault(ch, {})  #@build
            node["#"] = True                    #@build
        res = []
        for word in sentence.split():           #@word
            node, cut = root, word              #@word
            for i, ch in enumerate(word):       #@walk
                if ch not in node:              # 路断了：没有词根是它的前缀 #@walk
                    break                       #@walk
                node = node[ch]                 #@walk
                if "#" in node:                 # 第一次碰到结束标记：最短的词根 #@hit
                    cut = word[:i + 1]          #@hit
                    break                       #@hit
            res.append(cut)                     #@add
        return " ".join(res)                    #@done
` }],
    sig: { fn: "replaceWords", params: ["List<string>", "string"], ret: "string" },
    call: (a) => [a.dictionary, a.sentence],
    cases: [[["cat", "bat", "rat"], "the cattle was rattled by the battery"], [["a", "b", "c"], "aadsfasf absbs bbab cadsfafs"], [["abc"], "ab abc abcd"]],
    gen: (R) => {
      const dictionary = [...new Set(Array.from({ length: R.int(2, 4) }, () => R.word(R.int(1, 3), "abc")))];
      const sentence = Array.from({ length: R.int(2, 4) }, () => R.word(R.int(1, 5), "abc")).join(" ");
      return { args: { dictionary, sentence }, note: `dictionary = ${R.fmt(dictionary)}, sentence = "${sentence}"` };
    },
    demo: {
      legend: [["a", "正在看的单词 / 走过的节点"], ["c", "词根在这里结束"]],
      presets: [{ label: "示例 1", args: { dictionary: ["cat", "bat", "rat", "ca"], sentence: "the cattle was rattled by the battery" }, note: 'dictionary = ["cat","bat","rat","ca"], sentence = "the cattle was rattled by the battery"', expect: "the ca was rat by the bat" }],
      build(a, snap) {
        const T = [{ ch: "", kids: {}, end: false, depth: 0 }];
        for (const w of a.dictionary) {
          let node = 0;
          for (const ch of w) { if (!(ch in T[node].kids)) { T.push({ ch, kids: {}, end: false, depth: T[node].depth + 1 }); T[node].kids[ch] = T.length - 1; } node = T[node].kids[ch]; }
          T[node].end = true;
        }
        const words = a.sentence.split(" "), res = [];
        let path = [], at = -1;
        const view = () => {
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
          T.forEach((nd, i) => { for (const k in nd.kids) edges.push([i, nd.kids[k], path.includes(i) && path.includes(nd.kids[k]) ? "on" : ""]); });
          return [
            { t: "array", label: "句子里的单词", items: words.map((w, i) => ({ v: w, cls: i === at ? "a" : i < at ? "d" : "" })), idx: false },
            { t: "net", label: "词根的字典树", directed: true, pos, nodes: T.map((nd, i) => ({ v: i ? nd.ch : "根", cls: path.includes(i) && i ? "a" : nd.end ? "c" : "" })), edges },
            { t: "chips", label: "结果", items: res.slice(), empty: "空" },
          ];
        };
        snap("建字典树", `把 ${a.dictionary.length} 个词根插进字典树，绿色的节点表示有词根在这里结束。`, view(), { at: "build" });
        words.forEach((w, i) => {
          at = i; path = [0];
          let node = 0, cut = w, why = "";
          for (let k = 0; k < w.length; k++) {
            const ch = w[k];
            if (!(ch in T[node].kids)) { why = k ? `走过 "${w.slice(0, k)}" 之后，'${ch}' 这条路不存在` : `第一个字符 '${ch}' 就走不下去`; break; }
            node = T[node].kids[ch]; path.push(node);
            if (T[node].end) { cut = w.slice(0, k + 1); why = `走到 "${cut}" 时碰到了结束标记`; break; }
          }
          if (!why) why = "单词走完了也没碰到结束标记";
          res.push(cut);
          snap(`看 "${w}"`, `${why}，${cut === w ? "不换" : `换成词根 "${cut}"`}。`, view(), { at: ["word", "walk", ...(cut !== w ? ["hit"] : []), "add"] });
        });
        at = words.length; path = [];
        const ans = res.join(" ");
        snap("完成", `结果是 "${ans}"。`, view(), { at: "done", kind: "ok", ans });
      },
    },
  }],
};
