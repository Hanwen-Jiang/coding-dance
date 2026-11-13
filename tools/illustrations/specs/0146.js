module.exports = {
  id: 146, name: "LRU 缓存", title: "LRU 缓存图解", level: "中等", topic: "链表",
  h1: "LRU 缓存，哈希表负责找，双向链表负责排队",
  lede: "get 和 put 都要 O(1)。哈希表能 O(1) 找到一个键，但不知道谁最久没用；链表能按使用顺序排队，但找一个键要从头找。把两个结构配合起来：哈希表里存的是链表节点，找到节点后直接在链表里挪动它。",
  hints: [
    { t: "需要哪些操作", body: ["按键查找；把一个键标记为「刚用过」；容量满时删掉最久没用的。三个操作都要 <code>O(1)</code>。"] },
    { t: "用链表表示新旧", body: ["链表头部放最近用过的，尾部放最久没用的。", "访问一个键：把它的节点移到头部。淘汰：删掉尾部的节点。"] },
    { t: "为什么是双向链表 + 哈希表", body: ["把节点从链表中间摘下来，需要知道它前后两个节点，所以要双向链表。", "哈希表存「键 → 节点」，这样不用遍历就能拿到节点。节点里还要存键，淘汰尾节点时才知道去哈希表里删哪个键。"] },
  ],
  codes: [{ t: "标准解法：哈希表 + 双向链表", code: `
class Node:
    def __init__(self, key=0, val=0):
        self.key, self.val = key, val
        self.prev = self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.map = {}                   # key -> Node
        self.head, self.tail = Node(), Node()   # 两个哨兵，省掉判空
        self.head.next, self.tail.prev = self.tail, self.head

    def _remove(self, node):
        node.prev.next, node.next.prev = node.next, node.prev

    def _add_front(self, node):
        node.prev, node.next = self.head, self.head.next
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key not in self.map:
            return -1
        node = self.map[key]
        self._remove(node)              # 挪到头部，表示刚用过
        self._add_front(node)
        return node.val

    def put(self, key: int, value: int) -> None:
        if key in self.map:
            self._remove(self.map[key])
        node = Node(key, value)
        self.map[key] = node
        self._add_front(node)
        if len(self.map) > self.cap:
            last = self.tail.prev       # 尾部是最久没用的
            self._remove(last)
            del self.map[last.key]
` }, { t: "极简写法：OrderedDict", kind: "elegant", note: "Python 的 OrderedDict 内部就是哈希表加双向链表。面试时可以先说这个，再手写上面的版本。", code: `
class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.d = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self.d:
            return -1
        self.d.move_to_end(key)         # 末尾是最近用过的
        return self.d[key]

    def put(self, key: int, value: int) -> None:
        self.d[key] = value
        self.d.move_to_end(key)
        if len(self.d) > self.cap:
            self.d.popitem(last=False)  # 弹出最前面的，也就是最久没用的
` }],
  pytest: `
c = LRUCache(2)
out = [c.put(1,1), c.put(2,2), c.get(1), c.put(3,3), c.get(2), c.put(4,4), c.get(1), c.get(3), c.get(4)]
assert out == [None, None, 1, None, -1, None, -1, 3, 4]
c = LRUCache(1); c.put(2,1); assert c.get(2) == 1; c.put(3,2); assert c.get(2) == -1 and c.get(3) == 2
c = LRUCache(2); c.put(2,1); c.put(2,2); assert c.get(2) == 2; c.put(1,1); c.put(4,1); assert c.get(2) == -1
`,
  legend: [["a", "正在执行的操作"], ["c", "刚用过，移到头部"], ["w", "被淘汰"]],
  presets: [
    { label: "示例 1", args: { cap: 2, ops: [["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2], ["put", 4, 4], ["get", 1], ["get", 3], ["get", 4]] }, note: "容量 2：put(1,1) put(2,2) get(1) put(3,3) get(2) put(4,4) get(1) get(3) get(4)", expect: [null, null, 1, null, -1, null, -1, 3, 4] },
    { label: "更新已有的键", args: { cap: 2, ops: [["put", 1, 1], ["put", 2, 2], ["put", 1, 10], ["put", 3, 3], ["get", 2], ["get", 1]] }, note: "容量 2：put(1,1) put(2,2) put(1,10) put(3,3) get(2) get(1)", expect: [null, null, null, null, -1, 10] },
  ],
  build(a, snap) {
    const { cap, ops } = a, out = []; let order = [], hot = null, evicted = null;
    const name = (o) => (o[0] === "put" ? `put(${o[1]},${o[2]})` : `get(${o[1]})`);
    const view = (i) => [
      { t: "chips", label: "操作", items: ops.map((o, t) => ({ v: name(o), cls: t === i ? "a" : t < i ? "d" : "" })) },
      { t: "list", label: "双向链表（左边最近用过，右边最久没用；写的是 键=值）", nodes: order.length ? order.map(([k, v]) => ({ v: `${k}=${v}`, cls: k === hot ? "c" : "" })).concat(evicted ? [{ v: `${evicted[0]}=${evicted[1]}`, cls: "w" }] : []) : [{ v: "空", cls: "d" }], showNil: false },
      { t: "chips", label: "哈希表里的键", items: order.map(([k]) => k).sort((x, y) => x - y), empty: "空" },
      { t: "chips", label: "输出", items: out.map((v) => (v === null ? "null" : v)), empty: "还没有" },
    ];
    snap("开始", `缓存容量是 ${cap}，一开始是空的。`, view(-1), { facts: [["容量", cap], ["已用", 0]] });
    ops.forEach((o, i) => {
      hot = null; evicted = null; let msg;
      if (o[0] === "get") {
        const t = order.findIndex(([k]) => k === o[1]);
        if (t < 0) { out.push(-1); msg = `get(${o[1]})：哈希表里没有键 ${o[1]}，返回 <b>-1</b>。`; }
        else { const e = order.splice(t, 1)[0]; order.unshift(e); hot = e[0]; out.push(e[1]); msg = `get(${o[1]})：通过哈希表找到节点，返回 <b>${e[1]}</b>。它刚被用过，移到链表头部。`; }
      } else {
        const t = order.findIndex(([k]) => k === o[1]);
        if (t >= 0) { order.splice(t, 1); msg = `put(${o[1]},${o[2]})：键 ${o[1]} 已经存在，更新它的值，并移到链表头部。`; }
        else msg = `put(${o[1]},${o[2]})：新的键，放到链表头部，同时记进哈希表。`;
        order.unshift([o[1], o[2]]); hot = o[1]; out.push(null);
        if (order.length > cap) { evicted = order.pop(); msg += `现在有 ${cap + 1} 个，超过容量。<b>淘汰链表尾部的键 ${evicted[0]}</b>，并从哈希表里删掉它。`; }
      }
      snap(name(o), msg, view(i), { kind: evicted ? "warn" : "", facts: [["容量", cap], ["已用", order.length]] });
    });
    hot = null; evicted = null;
    snap("完成", `所有操作执行完，输出是 [${out.map((v) => (v === null ? "null" : v)).join(", ")}]。`, view(ops.length), { kind: "ok", ans: out, facts: [["容量", cap], ["已用", order.length]] });
  },
  points: [
    { t: "节点里要存 key", body: "淘汰尾节点时，要用它的 key 去哈希表里删。只存 value 就找不到了。" },
    { t: "两个哨兵节点", body: "head 和 tail 是不存数据的假节点。有了它们，插入和删除不用判断是不是在两端。" },
    { t: "get 也算使用", body: "get 命中后要把节点移到头部。put 已有的键同样要移到头部。" },
  ],
};
