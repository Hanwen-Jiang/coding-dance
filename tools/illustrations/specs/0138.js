module.exports = {
  id: 138, name: "随机链表的复制", title: "随机链表的复制图解", level: "中等", topic: "链表",
  h1: "随机链表的复制，先把人都造出来再连关系",
  lede: "难点在 random 指针：复制到某个节点时，它 random 指向的节点可能还没被复制出来。所以分两遍：第一遍只造新节点，并用哈希表记下每个旧节点对应哪个新节点；第二遍再照着旧节点的指针，把新节点连起来。",
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
    const d = a.d, n = d.length, made = [], nnext = d.map(() => null), nrand = [];
    const view = (i) => [
      { t: "list", label: "原链表（实线 next，虚线 random）", nodes: d.map(([v], t) => ({ v, cls: t === i ? "a" : "" })), extra: d.map(([, r], t) => [t, r]).filter(([, r]) => r !== null), ptrs: { cur: i >= 0 && i < n ? i : null } },
      { t: "chips", label: "哈希表（旧节点 → 新节点）", items: made.map((t) => `旧 ${d[t][0]} → 新 ${d[t][0]}`), empty: "空" },
      { t: "list", label: "新链表", nodes: d.map(([v], t) => ({ v, cls: "k", hide: !made.includes(t) })), next: nnext.slice(), showNil: false, extra: nrand.slice() },
    ];
    snap("开始", "分两遍。第一遍只造新节点，不连任何指针。", view(-1), { at: "init" });
    for (let i = 0; i < n; i++) { made.push(i); snap("第一遍：造节点", `为旧节点 ${d[i][0]} 造一个值相同的新节点，在哈希表里记下对应关系。`, view(i), { at: "make" }); }
    snap("第二遍", "所有新节点都有了。再走一遍，照着旧节点的 next 和 random，把新节点连起来。", view(-1), { at: "link" });
    for (let i = 0; i < n; i++) {
      nnext[i] = i + 1 < n ? i + 1 : null;
      const r = d[i][1];
      if (r !== null) nrand.push([i, r]);
      snap("第二遍：连指针", `旧 ${d[i][0]} 的 next 是${i + 1 < n ? " " + d[i + 1][0] : "空"}，random 是${r === null ? "空" : " " + d[r][0]}。查表，让新 ${d[i][0]} 的 next 指向${i + 1 < n ? "新 " + d[i + 1][0] : "空"}，random 指向${r === null ? "空" : "新 " + d[r][0]}。`, view(i), { at: "link" });
    }
    snap("完成", "新链表的结构和原链表一模一样，但每个节点都是新造的。返回表里头节点对应的新节点。", view(-1), { at: "done", kind: "ok", ans: d });
  },
  points: [
    { t: "用 m.get 处理空指针", body: "<code>m.get(None)</code> 返回 <code>None</code>，正好对应「旧指针是空，新指针也是空」，不用单独判断。" },
    { t: "键是节点对象", body: "哈希表的键是旧节点本身，不是它的值。值可能重复，节点对象不会。" },
    { t: "O(1) 空间的做法", body: "把每个新节点插在对应旧节点的后面，用位置关系代替哈希表，最后再把两条链拆开。" },
  ],
};
