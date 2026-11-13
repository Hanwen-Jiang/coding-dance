module.exports = {
  id: 155, name: "最小栈", title: "最小栈图解", level: "中等", topic: "栈",
  h1: "最小栈，每一层都记着当时的最小值",
  lede: "栈只会从顶上进出，所以「当前栈里的最小值」只取决于栈里有哪些元素。每压入一个元素时，顺便记下压入后整个栈的最小值；弹出时这个记录一起弹掉，下面那一层的记录自然就是新的最小值。",
  hints: [
    { t: "只用一个变量为什么不够", body: ["弹出的正好是最小值时，你不知道剩下的元素里谁最小，只能重新扫一遍，做不到 O(1)。"] },
    { t: "多存一份信息", body: ["再开一个栈 <code>mins</code>，和主栈同步进出。<code>mins[i]</code> 是主栈前 <code>i + 1</code> 个元素的最小值。", "压入 <code>val</code> 时，<code>mins</code> 压入 <code>min(val, mins[-1])</code>。"] },
    { t: "也可以存成一对", body: ["只用一个栈，每个元素存 <code>(值, 压入后的最小值)</code>。"] },
  ],
  codes: [{ t: "标准解法：辅助栈", code: `
class MinStack:
    def __init__(self):
        self.stack = []
        self.mins = []                      # mins[-1] 是当前栈里的最小值

    def push(self, val: int) -> None:
        self.stack.append(val)
        self.mins.append(min(val, self.mins[-1]) if self.mins else val)

    def pop(self) -> None:
        self.stack.pop()
        self.mins.pop()                     # 和主栈同步弹出

    def top(self) -> int:
        return self.stack[-1]

    def getMin(self) -> int:
        return self.mins[-1]
` }, { t: "简洁写法：一个栈存二元组 + 哨兵", kind: "elegant", note: "栈底放一个最小值为 inf 的哨兵，push 时就不用判断栈是否为空。", code: `
from math import inf

class MinStack:
    def __init__(self):
        self.st = [(0, inf)]

    def push(self, val: int) -> None:
        self.st.append((val, min(val, self.st[-1][1])))

    def pop(self) -> None:
        self.st.pop()

    def top(self) -> int:
        return self.st[-1][0]

    def getMin(self) -> int:
        return self.st[-1][1]
` }],
  pytest: `
m = MinStack()
m.push(-2); m.push(0); m.push(-3)
assert m.getMin() == -3
m.pop()
assert m.top() == 0 and m.getMin() == -2
m = MinStack()
m.push(0); m.push(1); m.push(0)
assert m.getMin() == 0
m.pop()
assert m.getMin() == 0
m.pop(); m.pop(); m.push(5)
assert m.top() == 5 and m.getMin() == 5
`,
  legend: [["a", "正在执行的操作"], ["c", "当前的最小值"]],
  presets: [
    { label: "示例", args: { ops: [["push", -2], ["push", 0], ["push", -3], ["getMin"], ["pop"], ["top"], ["getMin"]] }, note: "push(-2) push(0) push(-3) getMin() pop() top() getMin()", expect: [null, null, null, -3, null, 0, -2] },
    { label: "重复的最小值", args: { ops: [["push", 0], ["push", 1], ["push", 0], ["getMin"], ["pop"], ["getMin"]] }, note: "push(0) push(1) push(0) getMin() pop() getMin()", expect: [null, null, null, 0, null, 0] },
  ],
  build(a, snap) {
    const ops = a.ops, st = [], mins = [], out = [];
    const name = (o) => (o[0] === "push" ? `push(${o[1]})` : `${o[0]}()`);
    const view = (i) => [
      { t: "chips", label: "操作", items: ops.map((o, t) => ({ v: name(o), cls: t === i ? "a" : t < i ? "d" : "" })) },
      { t: "array", label: "stack（右边是栈顶）", items: st.length ? st.slice() : [{ v: "", cls: "d" }], ptrs: {} },
      { t: "array", label: "mins（和 stack 一一对应）", items: mins.length ? mins.map((v, k) => ({ v, cls: k === mins.length - 1 ? "c" : "" })) : [{ v: "", cls: "d" }], ptrs: {} },
      { t: "chips", label: "输出", items: out.map((v) => (v === null ? "null" : v)), empty: "还没有" },
    ];
    snap("开始", "两个栈都是空的。", view(-1));
    ops.forEach((o, i) => {
      let msg;
      if (o[0] === "push") { const m = mins.length ? Math.min(o[1], mins[mins.length - 1]) : o[1]; st.push(o[1]); mins.push(m); out.push(null); msg = `把 ${o[1]} 压进 stack。压入后的最小值是 ${mins.length > 1 ? `min(${o[1]}, ${mins[mins.length - 2]})` : o[1]} = <b>${m}</b>，压进 mins。`; }
      else if (o[0] === "pop") { const v = st.pop(); mins.pop(); out.push(null); msg = `弹出 ${v}，mins 也同步弹出一层。现在的最小值是 ${mins.length ? mins[mins.length - 1] : "—"}。`; }
      else if (o[0] === "top") { out.push(st[st.length - 1]); msg = `栈顶是 <b>${st[st.length - 1]}</b>。`; }
      else { out.push(mins[mins.length - 1]); msg = `mins 的栈顶就是最小值，返回 <b>${mins[mins.length - 1]}</b>，O(1)。`; }
      snap(name(o), msg, view(i));
    });
    snap("完成", `输出是 [${out.map((v) => (v === null ? "null" : v)).join(", ")}]。`, view(ops.length), { kind: "ok", ans: out.slice() });
  },
  points: [
    { t: "重复的最小值也要压", body: "mins 每次都压一层，而不是只在更小时才压。否则弹出一个重复的最小值后，记录就对不上了。" },
    { t: "所有操作都是 O(1)", body: "push、pop、top、getMin 都只看栈顶。" },
    { t: "空间", body: "多了一个和主栈一样长的栈，空间 O(n)。" },
  ],
};
