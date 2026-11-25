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
        self.cap = capacity             #@init
        self.map = {}                   # key -> Node #@init
        self.head, self.tail = Node(), Node()   # 两个哨兵，省掉判空 #@init
        self.head.next, self.tail.prev = self.tail, self.head   #@init

    def _remove(self, node):
        node.prev.next, node.next.prev = node.next, node.prev

    def _add_front(self, node):
        node.prev, node.next = self.head, self.head.next
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        if key not in self.map:         #@miss
            return -1                   #@miss
        node = self.map[key]            #@hit
        self._remove(node)              # 挪到头部，表示刚用过 #@hit
        self._add_front(node)           #@hit
        return node.val                 #@hit

    def put(self, key: int, value: int) -> None:
        if key in self.map:             #@old
            self._remove(self.map[key]) #@old
        node = Node(key, value)         #@put
        self.map[key] = node            #@put
        self._add_front(node)           #@put
        if len(self.map) > self.cap:    #@evict
            last = self.tail.prev       # 尾部是最久没用的 #@evict
            self._remove(last)          #@evict
            del self.map[last.key]      #@evict
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
  sig: { cls: "LRUCache", ctor: ["int"], methods: { get: [["int"], "int"], put: [["int", "int"], "void"] } },
  call: (a) => [["LRUCache", ...a.ops.map((o) => o[0])], [[a.cap], ...a.ops.map((o) => o.slice(1))]],
  legend: [["a", "正在执行 / 定位节点"], ["c", "刚用过，移到头部"], ["w", "被移除 / 淘汰"], ["d", "哨兵 head / tail"]],
  presets: [
    { label: "示例 1", args: { cap: 2, ops: [["put", 1, 1], ["put", 2, 2], ["get", 1], ["put", 3, 3], ["get", 2], ["put", 4, 4], ["get", 1], ["get", 3], ["get", 4]] }, note: "容量 2：put(1,1) put(2,2) get(1) put(3,3) get(2) put(4,4) get(1) get(3) get(4)", expect: [null, null, 1, null, -1, null, -1, 3, 4] },
    { label: "更新已有的键", args: { cap: 2, ops: [["put", 1, 1], ["put", 2, 2], ["put", 1, 10], ["put", 3, 3], ["get", 2], ["get", 1]] }, note: "容量 2：put(1,1) put(2,2) put(1,10) put(3,3) get(2) get(1)", expect: [null, null, null, null, -1, 10] },
  ],
  build(a, snap) {
    const { cap, ops } = a, out = [];
    let order = []; // [[k, v], ...] 从最近到最久
    const name = (o) => (o[0] === "put" ? `put(${o[1]},${o[2]})` : `get(${o[1]})`);
    const makeListView = (opts = {}) => {
      const nodes = [{ v: "H", cls: "d" }];
      order.forEach(([k, v], idx) => {
        const nd = { v: `${k}=${v}`, cls: opts.clsAt && opts.clsAt[idx] ? opts.clsAt[idx] : "" };
        if (opts.prevAt && opts.prevAt[idx] !== undefined) nd.prev = opts.prevAt[idx];
        nodes.push(nd);
      });
      const evIdx = opts.evicted ? nodes.length : -1;
      if (opts.evicted) nodes.push({ v: `${opts.evicted[0]}=${opts.evicted[1]}`, cls: "w", noNil: true });
      const tailIdx = nodes.length;
      nodes.push({ v: "T", cls: "d" });
      const next = nodes.map((_, idx) => (idx + 1 < nodes.length ? idx + 1 : null));
      if (opts.evicted) {
        next[evIdx - 1] = tailIdx;
        next[evIdx] = null;
      }
      if (opts.hotEdges) {
        opts.hotEdges.forEach((idx) => {
          if (nodes[idx]) nodes[idx].ecls = "on";
        });
      }
      const ptrs = { head: 0, tail: tailIdx, ...(opts.ptrs || {}) };
      return {
        t: "list",
        label: "双向链表（H=head 最近使用，T=tail 最久未用；虚红线 × 表示断开的旧链接）",
        nodes,
        next: next.slice(),
        showNil: false,
        ptrs,
        ...(opts.ghostEdges ? { ghostEdges: opts.ghostEdges.slice() } : {}),
        ...(opts.animEdges ? { animEdges: opts.animEdges.slice() } : {}),
      };
    };
    const view = (i, opts = {}) => [
      { t: "chips", label: "操作", items: ops.map((o, t) => ({ v: name(o), cls: t === i ? "a" : t < i ? "d" : "" })) },
      makeListView(opts),
      { t: "chips", label: "哈希表里的键", items: order.map(([k]) => ({ v: k, cls: k === opts.mapHot ? "a" : "" })).sort((x, y) => x.v - y.v), empty: "空" },
      { t: "chips", label: "输出", items: out.map((v) => (v === null ? "null" : v)), empty: "还没有" },
    ];
    snap("初始化 LRUCache", `创建容量为 ${cap} 的缓存，两个哨兵 H 和 T 互相连接，哈希表为空。`, view(-1), {
      at: "init",
      facts: [["容量", cap], ["已用", 0]],
    });
    ops.forEach((o, i) => {
      if (o[0] === "get") {
        const t = order.findIndex(([k]) => k === o[1]);
        if (t < 0) {
          out.push(-1);
          snap(name(o), `get(${o[1]})：哈希表里没有键 ${o[1]}，缓存未命中，返回 <b>-1</b>。`, view(i), {
            at: "miss",
            kind: "warn",
            facts: [["容量", cap], ["已用", order.length], ["结果", -1]],
          });
          return;
        }
        const [k, v] = order[t];
        if (t > 0) {
          snap(`${name(o)} · 定位并摘下`, `get(${k})：通过哈希表 O(1) 找到节点 ${k}=${v}，先把它从当前位置摘下来（断开前后指针）。`, view(i, {
            clsAt: { [t]: "a" },
            mapHot: k,
            ptrs: { node: t + 1 },
            ghostEdges: [[t, t + 1], [t + 1, t + 2]],
          }), {
            at: "hit",
            facts: [["容量", cap], ["已用", order.length]],
          });
        }
        const e = order.splice(t, 1)[0];
        order.unshift(e);
        out.push(v);
        snap(`${name(o)} · 移到头部`, `把 ${k}=${v} 插到 H 后面（表示刚用过），返回 <b>${v}</b>。`, view(i, {
          clsAt: { 0: "c" },
          mapHot: k,
          ptrs: { node: 1 },
          hotEdges: t > 0 ? [0, 1] : [0],
          animEdges: t > 0 ? [0, 1] : [0],
          ...(t > 0 ? { ghostEdges: [[0, 2]] } : {}),
        }), {
          at: "hit",
          facts: [["容量", cap], ["已用", order.length], ["结果", v]],
        });
      } else {
        const [, k, v] = o;
        const t = order.findIndex(([key]) => key === k);
        let oldVal;
        if (t >= 0) {
          const prevUsed = order.length;
          oldVal = order[t][1];
          snap(`${name(o)} · 键已存在，先摘除旧节点`, `put(${k},${v})：哈希表里已有键 ${k}（旧值 ${oldVal}），先把旧节点从链表摘下。`, view(i, {
            clsAt: { [t]: "w" },
            mapHot: k,
            ptrs: { node: t + 1 },
            ghostEdges: [[t, t + 1], [t + 1, t + 2]],
          }), {
            at: "old",
            facts: [["容量", cap], ["已用", prevUsed]],
          });
          order.splice(t, 1);
        }
        const prevUsed = order.length;
        order.unshift([k, v]);
        const willEvict = order.length > cap;
        if (!willEvict) out.push(null);
        snap(`${name(o)} · 插入头部`, oldVal !== undefined
          ? `创建新节点 ${k}=${v}（旧值 ${oldVal} 已更新），记入哈希表并插到 H 后面。`
          : `创建新节点 ${k}=${v}，记入哈希表并插到 H 后面。${willEvict ? `当前已用 ${order.length} 超过容量 ${cap}，准备淘汰尾部。` : ""}`, view(i, {
          clsAt: { 0: "c" },
          ...(oldVal !== undefined && oldVal !== v ? { prevAt: { 0: `${k}=${oldVal}` } } : {}),
          mapHot: k,
          ptrs: { node: 1 },
          hotEdges: [0, 1],
          animEdges: [0, 1],
          ghostEdges: [[0, 2]],
        }), {
          at: "put",
          facts: [["容量", cap], ["已用", order.length, prevUsed]],
        });
        if (willEvict) {
          const beforeEvict = order.length;
          const evicted = order.pop();
          out.push(null);
          snap(`${name(o)} · 淘汰尾部`, `已用 ${beforeEvict} > 容量 ${cap}！淘汰最久没用的尾节点 <b>${evicted[0]}=${evicted[1]}</b>（tail.prev），并从哈希表删掉键 ${evicted[0]}。`, view(i, {
            evicted,
            ptrs: { last: order.length + 1 },
            hotEdges: [order.length],
            animEdges: [order.length],
            ghostEdges: [[order.length, order.length + 1], [order.length + 1, order.length + 2]],
          }), {
            at: "evict",
            kind: "warn",
            facts: [["容量", cap], ["已用", order.length, beforeEvict]],
          });
        }
      }
    });
    snap("完成", `所有操作执行完，输出是 [${out.map((v) => (v === null ? "null" : v)).join(", ")}]。`, view(ops.length), {
      at: [],
      kind: "ok",
      ans: out.slice(),
      facts: [["容量", cap], ["已用", order.length]],
    });
  },
  points: [
    { t: "节点里要存 key", body: "淘汰尾节点时，要用它的 key 去哈希表里删。只存 value 就找不到了。" },
    { t: "两个哨兵节点", body: "head 和 tail 是不存数据的假节点。有了它们，插入和删除不用判断是不是在两端。" },
    { t: "get 也算使用", body: "get 命中后要把节点移到头部。put 已有的键同样要移到头部。" },
  ],
};
