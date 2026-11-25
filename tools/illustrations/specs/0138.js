const F = require("../fig");

module.exports = {
  id: 138, name: "随机链表的复制", title: "随机链表的复制图解", level: "中等", topic: "链表",
  h1: "随机链表的复制，先把人都造出来再连关系",
  lede: "难点在 random 指针：复制到某个节点时，它 random 指向的节点可能还没被复制出来。所以分两遍：第一遍只造新节点，并用哈希表记下每个旧节点对应哪个新节点；第二遍再照着旧节点的指针，把新节点连起来。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "e1.png": [F.list([7, 13, 11, 10, 1], { label: "实线是 next，虚线是 random（7 的 random 是空）", random: [[1, 0], [2, 4], [3, 2], [4, 0]] })],
    "e2.png": [F.list([1, 2], { label: "两个节点的 random 都指向 2", random: [[0, 1], [1, 1]] })],
    "e3.png": [F.list([3, 3, 3], { label: "值可以重复：第 2 个节点的 random 指向第 1 个", random: [[1, 0]] })],
  },
  hints: [
    { t: "为什么不能一遍做完", body: ["<code>random</code> 可以指向后面的节点。复制第 1 个节点时，它 <code>random</code> 指向的第 4 个节点还不存在，没法连。"] },
    { t: "需要一个对照表", body: ["用哈希表存「旧节点 → 新节点」。", "有了它，旧节点指向谁，新节点就指向那个节点在表里对应的新节点。"] },
    { t: "两遍遍历", body: ["第一遍：给每个旧节点建一个值相同的新节点，放进哈希表。", "第二遍：<code>新.next = 表[旧.next]</code>，<code>新.random = 表[旧.random]</code>。指向空的就还是空。"] },
  ],
  codes: [{ t: "标准解法：哈希表，两遍遍历", code: `
class Solution:
    def copyRandomList(self, head: 'Optional[Node]') -> 'Optional[Node]':
        if not head:
            return None
        m = {}                          # 旧节点 -> 新节点 #@init
        cur = head                      #@init
        while cur:                      # 第一遍：只造节点 #@make
            m[cur] = Node(cur.val)      #@make
            cur = cur.next              #@make
        cur = head                      #@link
        while cur:                      # 第二遍：连指针 #@link
            m[cur].next = m.get(cur.next)       #@link
            m[cur].random = m.get(cur.random)   #@link
            cur = cur.next              #@link
        return m[head]                  #@done
` }, { t: "简洁写法：defaultdict 一遍完成", kind: "elegant", note: "第一次用到某个节点的副本时，defaultdict 自动创建它，所以 next 和 random 可以在一遍里接好。", code: `
class Solution:
    def copyRandomList(self, head: "Optional[Node]") -> "Optional[Node]":
        copy = defaultdict(lambda: Node(0))
        copy[None] = None
        node = head
        while node:
            copy[node].val = node.val
            copy[node].next = copy[node.next]
            copy[node].random = copy[node.random]
            node = node.next
        return copy[head]
` }],
  sig: { fn: "copyRandomList", params: ["RandomList"], ret: "RandomList" },
  call: (a) => [a.d],
  cases: [[[[1, null]]], [[[1, 0]]], [[[3, null], [3, 0], [3, null]]], [[[5, 2], [6, 2], [7, 2]]]],
  pytest: `
class Node:
    def __init__(self, x, next=None, random=None):
        self.val, self.next, self.random = int(x), next, random
def mk(data):
    nodes = [Node(v) for v, _ in data]
    for i, (_, r) in enumerate(data):
        nodes[i].next = nodes[i + 1] if i + 1 < len(nodes) else None
        nodes[i].random = nodes[r] if r is not None else None
    return nodes
for data in [[[7,None],[13,0],[11,4],[10,2],[1,0]], [[1,1],[2,1]], [[3,None],[3,0],[3,None]], []]:
    old = mk(data)
    new = Solution().copyRandomList(old[0] if old else None)
    out, idx, cur = [], {}, new
    while cur: idx[cur] = len(idx); cur = cur.next
    cur = new
    while cur:
        assert cur not in old
        out.append([cur.val, idx[cur.random] if cur.random else None]); cur = cur.next
    assert out == data
`,
  legend: [["a", "正在处理的旧节点"], ["k", "新节点"], ["dash", "random 指针"]],
  presets: [
    { label: "示例 1", args: { d: [[7, null], [13, 0], [11, 4], [10, 2], [1, 0]] }, note: "head = [[7,null],[13,0],[11,4],[10,2],[1,0]]", expect: [[7, null], [13, 0], [11, 4], [10, 2], [1, 0]] },
    { label: "示例 2", args: { d: [[1, 1], [2, 1]] }, note: "head = [[1,1],[2,1]]", expect: [[1, 1], [2, 1]] },
  ],
  build(a, snap) {
    const d = a.d, n = d.length, made = [], nnext = d.map(() => null), nrand = [], linkedNext = new Set();
    if (!n) {
      snap("完成", "链表是空的，直接返回空。", [{ t: "note", label: "链表", html: "空" }], { at: "done", kind: "ok", ans: [] });
      return;
    }
    const view = (i, opts = {}) => [
      {
        t: "list",
        label: "原链表（实线 next，虚线 random）",
        nodes: d.map(([v], t) => ({ v, cls: t === i ? "a" : "" })),
        next: d.map((_, t) => (t + 1 < n ? t + 1 : null)),
        extra: d.map(([, r], t) => [t, r]).filter(([, r]) => r !== null),
        ptrs: { cur: i >= 0 && i < n ? i : null },
      },
      {
        t: "chips",
        label: "哈希表 m（旧节点 → 新节点）",
        items: made.map((t) => ({ v: `旧 ${d[t][0]}#${t} → 新 ${d[t][0]}#${t}`, cls: t === i ? "a" : "k" })),
        empty: "空",
      },
      {
        t: "list",
        label: "新链表（虚线 random）",
        nodes: d.map(([v], t) => ({
          v,
          cls: t === i && opts.hlNew ? "a" : "k",
          hide: !made.includes(t),
          noNil: nnext[t] === null && !linkedNext.has(t),
          ...(opts.hot === t ? { ecls: "on" } : {}),
        })),
        next: nnext.slice(),
        extra: nrand.map((pair) => pair.slice()),
        ptrs: { "m[cur]": opts.showNewPtr && i >= 0 && i < n ? i : null },
        ...(opts.animEdges && opts.animEdges.length ? { animEdges: opts.animEdges.slice() } : {}),
      },
    ];
    snap("开始", "分两遍。第一遍只造新节点，并用哈希表 m 记下每个旧节点对应哪个新节点。", view(-1), {
      at: "init",
      facts: [["阶段", "准备"], ["已造节点", 0]],
    });
    for (let i = 0; i < n; i++) {
      const prevMade = made.length;
      made.push(i);
      snap(
        "第一遍：造节点",
        `为旧节点 <b>${d[i][0]}#${i}</b> 造一个值相同的新节点，并在哈希表 m 里记下映射关系。`,
        view(i, { hlNew: true, showNewPtr: true }),
        { at: "make", facts: [["阶段", "第一遍：造节点", i === 0 ? "准备" : undefined], ["已造节点", made.length, prevMade]] },
      );
    }
    snap("第二遍", "所有新节点都造好了，cur 回到头节点。再走一遍，照着旧节点的 next 和 random 把新节点连起来。", view(-1), {
      at: "link",
      facts: [["阶段", "第二遍：连指针", "第一遍：造节点"], ["已造节点", n], ["已连指针", 0]],
    });
    let links = 0;
    for (let i = 0; i < n; i++) {
      const nxt = i + 1 < n ? i + 1 : null;
      nnext[i] = nxt;
      linkedNext.add(i);
      const prevLinks1 = links;
      links += 1;
      snap(
        "连 next 指针",
        `旧节点 <b>${d[i][0]}#${i}</b> 的 next 是${nxt !== null ? ` <b>${d[nxt][0]}#${nxt}</b>，查表让新节点 next 指向 <b>新 ${d[nxt][0]}#${nxt}</b>` : "<b>空</b>，新节点 next 也指向空"}。`,
        view(i, { hlNew: true, showNewPtr: true, hot: i, animEdges: [i] }),
        { at: "link", facts: [["阶段", "第二遍：连指针"], ["已造节点", n], ["已连指针", links, prevLinks1]] },
      );
      const r = d[i][1];
      if (r !== null) nrand.push([i, r]);
      const prevLinks2 = links;
      links += 1;
      snap(
        "连 random 指针",
        `旧节点 <b>${d[i][0]}#${i}</b> 的 random 是${r === null ? "<b>空</b>，m.get(None) 返回空，新节点 random 也指向空" : ` <b>${d[r][0]}#${r}</b>，查表让新节点 random 指向 <b>新 ${d[r][0]}#${r}</b>`}。`,
        view(i, { hlNew: true, showNewPtr: true }),
        { at: "link", facts: [["阶段", "第二遍：连指针"], ["已造节点", n], ["已连指针", links, prevLinks2]] },
      );
    }
    snap("完成", `新链表的结构和原链表一模一样，但每个节点都是新造的。返回 m[head]（<b>新 ${d[0][0]}#0</b>）。`, view(-1), {
      at: "done",
      kind: "ok",
      ans: d.map(([v, r]) => [v, r]),
      facts: [["阶段", "完成", "第二遍：连指针"], ["已造节点", n], ["已连指针", links]],
    });
  },
  points: [
    { t: "用 m.get 处理空指针", body: "<code>m.get(None)</code> 返回 <code>None</code>，正好对应「旧指针是空，新指针也是空」，不用单独判断。" },
    { t: "键是节点对象", body: "哈希表的键是旧节点本身，不是它的值。值可能重复，节点对象不会。" },
    { t: "O(1) 空间的做法", body: "把每个新节点插在对应旧节点的后面，用位置关系代替哈希表，最后再把两条链拆开。" },
  ],
};
