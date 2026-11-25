module.exports = {
  slug: "stack-queue", name: "栈与队列", kind: "ds", order: 4,
  lede: "栈是后进先出：只能在一头放、在同一头拿，像一摞盘子。队列是先进先出：一头进、另一头出，像排队。括号匹配、表达式求值、撤销操作用栈；按层遍历、按顺序处理任务用队列。",
  related: [20, 155, 394, 739, 84, 239, 102],
  sections: [{
    key: "stack", t: "栈：逆波兰表达式",
    body: [
      "逆波兰表达式把运算符写在两个数后面：<code>2 1 + 3 *</code> 就是 <code>(2 + 1) * 3</code>。从左往右读，遇到数字就压栈；遇到运算符，栈顶的两个数正好是它的两个操作数，弹出来算完再把结果压回去。",
      "注意弹出的顺序：<b>先弹出的是右边的数</b>。减法和除法不能交换，<code>a - b</code> 里的 a 是后弹出的那个。",
      "各语言的栈：Python 用 <code>list</code> 的 <code>append</code> / <code>pop</code>，Java 用 <code>ArrayDeque</code> 的 <code>push</code> / <code>pop</code>（不推荐老的 <code>Stack</code> 类），C++ <code>stack</code>，Go 和 JavaScript 用切片 / 数组的末尾。",
    ],
    points: [
      { t: "除法向零取整", body: "题目要求向零取整。Python 的 <code>//</code> 是向下取整，<code>-7 // 2 = -4</code>，要写 <code>int(a / b)</code>；JavaScript 用 <code>Math.trunc</code>。" },
      { t: "负数也是数字", body: "<code>\"-11\"</code> 是一个数，不是减号。判断运算符要看整个字符串，不能只看第一个字符。" },
    ],
    codes: [{ t: "用栈求值", key: "stack", code: `
class Solution:
    def evalRPN(self, tokens: List[str]) -> int:
        stack = []                              #@init
        for t in tokens:                        #@loop
            if t not in ("+", "-", "*", "/"):   #@push
                stack.append(int(t))            # 数字直接压栈 #@push
                continue                        #@push
            b = stack.pop()                     # 先弹出的是右边的数 #@pop
            a = stack.pop()                     #@pop
            if t == "+":                        #@calc
                stack.append(a + b)             #@calc
            elif t == "-":                      #@calc
                stack.append(a - b)             #@calc
            elif t == "*":                      #@calc
                stack.append(a * b)             #@calc
            else:                               #@calc
                stack.append(int(a / b))        # 向零取整 #@calc
        return stack[0]                         #@done
` }],
    sig: { fn: "evalRPN", params: ["string[]"], ret: "int" },
    call: (a) => [a.tokens],
    cases: [[["2", "1", "+", "3", "*"]], [["4", "13", "5", "/", "+"]], [["10", "6", "9", "3", "+", "-11", "*", "/", "*", "17", "+", "5", "+"]], [["7", "-2", "/"]], [["42"]]],
    gen: (R) => {
      // 随机生成一棵表达式树，再后序输出；除法只在能整除时用，避免除以 0
      const make = (d) => {
        if (d === 0 || R.chance(0.3)) { const v = R.int(1, 9); return { tok: [String(v)], v }; }
        const l = make(d - 1), r = make(d - 1);
        let op = R.pick(["+", "-", "*", "/"]);
        if (op === "/" && (r.v === 0 || l.v % r.v !== 0)) op = R.pick(["+", "-"]);
        const v = op === "+" ? l.v + r.v : op === "-" ? l.v - r.v : op === "*" ? l.v * r.v : Math.trunc(l.v / r.v);
        return { tok: [...l.tok, ...r.tok, op], v };
      };
      let e = make(3);
      while (e.tok.length < 3) e = make(3);
      return { args: { tokens: e.tok }, note: `tokens = ${R.fmt(e.tok)}` };
    },
    demo: {
      legend: [["a", "正在读的记号"], ["d", "已经读过"]],
      presets: [
        { label: "示例 1", args: { tokens: ["2", "1", "+", "3", "*"] }, note: 'tokens = ["2","1","+","3","*"]', expect: 9 },
        { label: "示例 2", args: { tokens: ["4", "13", "5", "/", "+"] }, note: 'tokens = ["4","13","5","/","+"]', expect: 6 },
      ],
      build(a, snap) {
        const T = a.tokens, st = [];
        let at = -1;
        const view = (hot) => [
          {
            t: "array",
            label: "tokens",
            items: T.map((x, i) => ({ v: x, cls: i === at ? "a" : i < at ? "d" : "" })),
            ptrs: { i: at >= 0 && at < T.length ? at : null },
          },
          {
            t: "chips",
            label: "栈（右边是栈顶）",
            items: st.map((x, i) => ({ v: x, cls: hot && i >= st.length - hot ? "a" : "" })),
            empty: "空",
          },
        ];
        snap("开始", "从左往右读，栈一开始是空的。", view(), {
          at: "init",
          facts: [["当前记号", "—"], ["栈大小", 0], ["栈顶", "空"]],
        });
        T.forEach((t, i) => {
          at = i;
          if (!["+", "-", "*", "/"].includes(t)) {
            const oldLen = st.length, oldTop = oldLen ? st[oldLen - 1] : "空";
            const num = Number(t);
            st.push(num);
            snap("数字", `${t} 是数字，压栈。`, view(1), {
              at: ["loop", "push"],
              facts: [["当前记号", t], ["操作", `压入 ${num}`], ["栈大小", st.length, oldLen], ["栈顶", num, oldTop]],
            });
            return;
          }
          const oldLen = st.length, oldTop = st[oldLen - 1];
          const b = st.pop(), x = st.pop();
          const v = t === "+" ? x + b : t === "-" ? x - b : t === "*" ? x * b : Math.trunc(x / b);
          snap("运算符", `遇到 ${t}：先弹出右边的数 ${b}，再弹出左边的数 ${x}。`, view(), {
            at: ["loop", "pop"],
            facts: [["当前记号", t], ["弹出右数 b / 左数 a", `${b} / ${x}`], ["栈大小", st.length, oldLen], ["栈顶", st.length ? st[st.length - 1] : "空", oldTop]],
          });
          const lenBeforePush = st.length, topBeforePush = lenBeforePush ? st[lenBeforePush - 1] : "空";
          st.push(v);
          snap("算完压回", `${x} ${t} ${b} = ${v}，把结果压回栈里。`, view(1), {
            at: "calc",
            facts: [["计算", `${x} ${t} ${b} = ${v}`], ["栈大小", st.length, lenBeforePush], ["栈顶", v, topBeforePush]],
          });
        });
        at = T.length;
        snap("完成", `读完了，栈里只剩一个数 ${st[0]}，就是答案。`, view(1), {
          at: "done",
          kind: "ok",
          ans: st[0],
          facts: [["表达式结果", st[0]], ["栈大小", st.length]],
        });
      },
    },
  }, {
    key: "queue", t: "队列：用两个栈实现",
    body: [
      "两个栈能拼出一个队列：新元素都压进 <code>inbox</code>；要出队时从 <code>outbox</code> 弹。outbox 空了，就把 inbox 整个倒进 outbox，顺序正好翻过来，最早进来的到了栈顶。",
      "每个元素最多进出两个栈各一次，所以虽然有时一次要倒很多个，<b>平均</b>每次操作还是 O(1)（均摊复杂度）。",
      "真正要用队列时：Python <code>collections.deque</code>（<code>append</code> / <code>popleft</code>），Java <code>ArrayDeque</code>（<code>offer</code> / <code>poll</code>），C++ <code>queue</code>，Go 和 JavaScript 用切片 / 数组加一个队头下标。",
    ],
    points: [
      { t: "只在 outbox 空的时候倒", body: "outbox 里还有元素时就倒，会把后来的元素压到前面的元素上面，顺序就乱了。" },
      { t: "别用 list.pop(0)", body: "Python 列表从头删是 O(n)，JavaScript 的 <code>shift()</code> 也可能是 O(n)。BFS 里用 deque 或者队头下标。" },
    ],
    codes: [{ t: "两个栈", key: "queue", code: `
class MyQueue:
    def __init__(self):
        self.inbox = []                 # 新元素都压进这里 #@init
        self.outbox = []                # 出队都从这里弹 #@init

    def push(self, x: int) -> None:
        self.inbox.append(x)            #@push

    def pop(self) -> int:
        self.peek()                     # 先保证 outbox 里有元素 #@pop
        return self.outbox.pop()        #@pop

    def peek(self) -> int:
        if not self.outbox:             # outbox 空了才倒 #@move
            while self.inbox:           # 把 inbox 整个倒过来 #@move
                self.outbox.append(self.inbox.pop())    #@move
        return self.outbox[-1]          #@peek

    def empty(self) -> bool:
        return not self.inbox and not self.outbox       #@empty
` }],
    sig: { cls: "MyQueue", ctor: [], methods: { push: [["int"], "void"], pop: [[], "int"], peek: [[], "int"], empty: [[], "bool"] } },
    call: (a) => [["MyQueue", ...a.ops.map((o) => o[0])], [[], ...a.ops.map((o) => o.slice(1))]],
    cases: [[["MyQueue", "push", "push", "peek", "pop", "empty"], [[], [1], [2], [], [], []]], [["MyQueue", "empty"], [[], []]]],
    gen: (R) => {
      const ops = [];
      let size = 0, v = 1;
      for (let k = R.int(6, 10); k > 0; k--) {
        const o = size === 0 || R.chance(0.45) ? "push" : R.pick(["pop", "pop", "peek", "empty"]);
        if (o === "push") { ops.push(["push", v++]); size++; } else { ops.push([o]); if (o === "pop") size--; }
      }
      return { args: { ops }, note: ops.map((o) => (o.length > 1 ? `${o[0]}(${o[1]})` : `${o[0]}()`)).join(" ") };
    },
    demo: {
      legend: [["a", "刚动过的元素"]],
      presets: [{ label: "示例", args: { ops: [["push", 1], ["push", 2], ["push", 3], ["pop"], ["push", 4], ["pop"], ["peek"], ["pop"], ["empty"]] }, note: "push(1) push(2) push(3) pop() push(4) pop() peek() pop() empty()", expect: [null, null, null, null, 1, null, 2, 3, 3, false] }],
      build(a, snap) {
        const inbox = [], outbox = [], out = [null];
        const opLabels = a.ops.map((o) => (o.length > 1 ? `${o[0]}(${o[1]})` : `${o[0]}()`));
        let hot = null, opIdx = -1;
        const view = () => [
          {
            t: "array",
            label: "操作序列",
            items: opLabels.map((lbl, i) => ({ v: lbl, cls: i === opIdx ? "a" : i < opIdx ? "d" : "" })),
            ptrs: { op: opIdx >= 0 && opIdx < opLabels.length ? opIdx : null },
          },
          { t: "chips", label: "inbox（右边是栈顶）", items: inbox.map((x) => ({ v: x, cls: x === hot ? "a" : "" })), empty: "空" },
          { t: "chips", label: "outbox（右边是栈顶）", items: outbox.map((x) => ({ v: x, cls: x === hot ? "a" : "" })), empty: "空" },
          { t: "chips", label: "返回值", items: out.map((x) => (x === null ? "null" : String(x))) },
        ];
        snap("开始", "初始化两个空栈 inbox 和 outbox。", view(), {
          at: "init",
          facts: [["当前操作", "MyQueue()"], ["inbox 长度", 0], ["outbox 长度", 0], ["返回值数", 1]],
        });
        a.ops.forEach(([op, x], idx) => {
          opIdx = idx;
          hot = null;
          const opStr = opLabels[idx];
          if (op === "push") {
            const oldIn = inbox.length, oldOutLen = out.length;
            inbox.push(x);
            hot = x;
            out.push(null);
            snap(`push(${x})`, `${x} 压进 inbox。`, view(), {
              at: "push",
              facts: [["当前操作", opStr], ["inbox 长度", inbox.length, oldIn], ["outbox 长度", outbox.length], ["返回值数", out.length, oldOutLen]],
            });
          } else if (op === "empty") {
            const oldOutLen = out.length;
            const e = !inbox.length && !outbox.length;
            out.push(e);
            snap("empty()", `两个栈${e ? "都空了，返回 true" : "里还有元素，返回 false"}。`, view(), {
              at: "empty",
              facts: [["当前操作", opStr], ["inbox 长度", inbox.length], ["outbox 长度", outbox.length], ["返回", String(e)], ["返回值数", out.length, oldOutLen]],
            });
          } else {
            let moved = false;
            if (!outbox.length && inbox.length) {
              moved = true;
              while (inbox.length) {
                const oldIn = inbox.length, oldOut = outbox.length;
                const oldOutTop = oldOut ? outbox[oldOut - 1] : "空";
                const mv = inbox.pop();
                outbox.push(mv);
                hot = mv;
                snap(`${op}()：倒出 ${mv}`, `outbox 空了，把 inbox 栈顶的 ${mv} 弹出并压进 outbox，顺序逐渐翻正。`, view(), {
                  at: op === "pop" ? ["pop", "move"] : "move",
                  facts: [["当前操作", opStr], ["inbox 长度", inbox.length, oldIn], ["outbox 长度", outbox.length, oldOut], ["outbox 栈顶", mv, oldOutTop]],
                });
              }
            }
            const top = outbox[outbox.length - 1];
            hot = top;
            const oldOutLen = out.length;
            if (op === "pop") {
              const oldOut = outbox.length;
              outbox.pop();
              out.push(top);
              snap("pop()", `${moved ? "倒完后，" : "outbox 里还有元素，不用倒。"}弹出 outbox 的栈顶 ${top}，它是最早进队的。`, view(), {
                at: "pop",
                facts: [["当前操作", opStr], ["弹出返回", top], ["outbox 长度", outbox.length, oldOut], ["返回值数", out.length, oldOutLen]],
              });
            } else {
              out.push(top);
              snap("peek()", `${moved ? "倒完后，" : "outbox 里还有元素，不用倒。"}outbox 的栈顶是 ${top}，只看不弹。`, view(), {
                at: "peek",
                facts: [["当前操作", opStr], ["队头元素", top], ["outbox 长度", outbox.length], ["返回值数", out.length, oldOutLen]],
              });
            }
          }
        });
        hot = null;
        opIdx = opLabels.length;
        snap("完成", "每个元素最多进出两个栈各一次。", view(), {
          at: [],
          kind: "ok",
          ans: out,
          facts: [["执行操作数", opLabels.length], ["inbox 长度", inbox.length], ["outbox 长度", outbox.length]],
        });
      },
    },
  }],
};
