module.exports = {
  id: 739, name: "每日温度", title: "每日温度图解", level: "中等", topic: "栈",
  h1: "每日温度，等待升温的日子排成一个栈",
  lede: "从左往右走，还没等到更高温度的日子先放进栈里。栈里的温度从底到顶是递减的。今天的温度比栈顶高，栈顶那天就等到了答案；一直弹到栈顶不比今天低为止，再把今天压进去。",
  hints: [
    { t: "暴力做法慢在哪", body: ["每一天都往后扫，找第一个更高的温度，最坏 O(n²)。", "能不能每天只处理一次？"] },
    { t: "谁在等待", body: ["从左往右走，把还没找到答案的日子记下来。如果某天比前一天低，前一天还在等，这一天也开始等。", "这些等待中的日子，温度从早到晚是递减的（否则早的那天已经等到了）。这就是单调栈。"] },
    { t: "今天能帮谁", body: ["今天温度 <code>t</code> 比栈顶那天高，栈顶那天就等到了，答案是两者下标之差，弹出。", "继续比较新的栈顶，直到栈顶不比 <code>t</code> 低。最后把今天压栈。"] },
  ],
  codes: [{ t: "标准解法：单调栈", code: `
class Solution:
    def dailyTemperatures(self, temperatures: List[int]) -> List[int]:
        ans = [0] * len(temperatures)
        stack = []                          # 还在等待的日子（下标），温度从底到顶递减
        for i, t in enumerate(temperatures):
            while stack and temperatures[stack[-1]] < t:
                j = stack.pop()
                ans[j] = i - j              # 第 j 天等到了第 i 天
            stack.append(i)
        return ans
` }, { t: "简洁写法：从右往左跳", kind: "elegant", note: "不用栈。从右往左算，ans[j] 已经告诉我们 j 之后第一个更热的日子在哪，比不过就直接跳过去。", code: `
class Solution:
    def dailyTemperatures(self, temperatures: List[int]) -> List[int]:
        T, n = temperatures, len(temperatures)
        ans = [0] * n
        for i in range(n - 2, -1, -1):
            j = i + 1
            while T[j] <= T[i] and ans[j]:
                j += ans[j]                 # 跳到比 T[j] 更热的那天
            if T[j] > T[i]:
                ans[i] = j - i
        return ans
` }],
  pytest: `
s = Solution()
assert s.dailyTemperatures([73,74,75,71,69,72,76,73]) == [1,1,4,2,1,1,0,0]
assert s.dailyTemperatures([30,40,50,60]) == [1,1,1,0]
assert s.dailyTemperatures([30,60,90]) == [1,1,0]
assert s.dailyTemperatures([90,80,70]) == [0,0,0]
assert s.dailyTemperatures([70,70,71]) == [2,1,0]
`,
  method: "单调栈",
  legend: [["e", "在栈里等待"], ["a", "今天"], ["c", "刚等到答案"]],
  presets: [
    { label: "示例 1", args: { t: [73, 74, 75, 71, 69, 72, 76, 73] }, note: "temperatures = [73,74,75,71,69,72,76,73]", expect: [1, 1, 4, 2, 1, 1, 0, 0] },
    { label: "示例 3", args: { t: [30, 60, 90] }, note: "temperatures = [30,60,90]", expect: [1, 1, 0] },
  ],
  build(a, snap) {
    const T = a.t, n = T.length, ans = Array(n).fill(null), stack = [];
    const view = (i, hit) => [
      { t: "bars", label: "temperatures", items: T.map((v, k) => ({ v, cls: k === i ? "a" : k === hit ? "c" : stack.includes(k) ? "e" : "" })), ptrs: { 今天: i >= 0 ? i : null } },
      { t: "array", label: "answer", items: ans.map((v) => (v === null ? "" : v)), ptrs: {} },
      { t: "chips", label: "栈（存下标，右边是栈顶）", items: stack.map((k) => `${k}:${T[k]}`), empty: "空" },
    ];
    snap("开始", "栈里放还在等更高温度的日子。", view(-1, -1));
    for (let i = 0; i < n; i++) {
      while (stack.length && T[stack[stack.length - 1]] < T[i]) {
        const j = stack.pop(); ans[j] = i - j;
        snap("等到了", `今天 ${T[i]} 比栈顶第 ${j} 天的 ${T[j]} 高，第 ${j} 天等了 <b>${i - j}</b> 天，弹出。`, view(i, j));
      }
      stack.push(i);
      snap("压栈", `${stack.length > 1 ? `栈顶 ${T[stack[stack.length - 2]]} 不比今天低，停下。` : ""}把第 ${i} 天（${T[i]}）压栈，开始等待。`, view(i, -1));
    }
    stack.forEach((k) => (ans[k] = 0));
    snap("完成", "栈里剩下的日子到最后也没等到更高温度，答案填 0。", view(-1, -1), { kind: "ok", ans: ans.slice() });
  },
  alts: [{
    t: "从右往左跳",
    note: "和简洁写法一样，不用栈：从右往左填 answer。比较第 i 天和第 j 天，第 j 天不够热时，answer[j] 直接告诉我们下一个比第 j 天热的日子，跳过去接着比。",
    legend: [["a", "第 i 天"], ["e", "正在比较的第 j 天"], ["c", "找到更热的那天"]],
    build(a, snap) {
      const T = a.t, n = T.length, ans = Array(n).fill(0), filled = new Set([n - 1]);
      const view = (i, j, hit) => [
        { t: "bars", label: "temperatures", items: T.map((v, k) => ({ v, cls: k === i ? "a" : k === hit ? "c" : k === j ? "e" : "" })), ptrs: { i: i >= 0 ? i : null, j: j >= 0 ? j : null } },
        { t: "array", label: "answer（从右往左填）", items: ans.map((v, k) => ({ v: filled.has(k) ? v : "", cls: k === i && hit >= 0 ? "c" : "" })) },
      ];
      snap("开始", `从右往左算。最后一天后面没有日子了，answer[${n - 1}] = 0。`, view(-1, -1, -1));
      for (let i = n - 2; i >= 0; i--) {
        let j = i + 1;
        snap("看第 i 天", `第 ${i} 天 ${T[i]}°，先和第二天比：第 ${j} 天 ${T[j]}°。`, view(i, j, -1));
        while (T[j] <= T[i] && ans[j]) {
          const nj = j + ans[j];
          snap("跳", `第 ${j} 天 ${T[j]}° 不比 ${T[i]}° 热。answer[${j}] = ${ans[j]}：第 ${j} 天之后第一个比它热的是第 ${nj} 天，中间的日子都不比第 ${j} 天热，更比不过 ${T[i]}°。直接跳到第 ${nj} 天（${T[nj]}°）。`, view(i, nj, -1));
          j = nj;
        }
        filled.add(i);
        if (T[j] > T[i]) { ans[i] = j - i; snap("找到", `第 ${j} 天 ${T[j]}° 比 ${T[i]}° 热，answer[${i}] = ${j} − ${i} = <b>${j - i}</b>。`, view(i, j, j)); }
        else snap("等不到", `第 ${j} 天 ${T[j]}° 不比 ${T[i]}° 热，而且 answer[${j}] = 0，它后面再没有更热的日子。answer[${i}] = 0。`, view(i, j, -1), { kind: "warn" });
      }
      snap("完成", `answer 填完了：[${ans.join(",")}]。`, view(-1, -1, -1), { kind: "ok", ans: ans.slice() });
    },
  }],
  points: [
    { t: "栈里存下标", body: "要算相隔几天，所以存下标，温度用下标去取。" },
    { t: "严格大于才弹出", body: "相同温度不算升温，<code>&lt;</code> 不能写成 <code>&lt;=</code>。" },
    { t: "复杂度", body: "每个下标最多进栈、出栈各一次，时间 O(n)，空间 O(n)。" },
  ],
};
