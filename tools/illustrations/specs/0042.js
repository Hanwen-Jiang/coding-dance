const F = require("../fig");

module.exports = {
  id: 42, name: "接雨水", title: "接雨水图解", level: "困难", topic: "双指针",
  h1: "接雨水，每一格能接多少只看两边最高的柱子",
  lede: "某一格上方的水位，等于它左边最高柱子和右边最高柱子里较矮的那个。用两个指针从两端往中间走，哪边的最高值更小，哪边那一格的水量就已经能确定。",
  // 题面配图：替换题面里力扣的图片（fig.js）
  figures: {
    "rainwatertrap.png": [F.bars([0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1], { label: "灰色是柱子，蓝色是接住的雨水，一共 6 个单位", water: [0, 0, 1, 0, 1, 2, 1, 0, 0, 1, 0, 0] })],
  },
  hints: [
    { t: "先只看一格", body: ["下标 <code>i</code> 这一格能接的水 = <code>min(左边最高, 右边最高) − height[i]</code>。", "水位由两边最高的柱子里矮的那个决定，再减掉这一格自己的高度。"] },
    { t: "朴素做法", body: ["预先算出每个位置的左边最高 <code>leftMax[i]</code> 和右边最高 <code>rightMax[i]</code>，再逐格相加。时间 <code>O(n)</code>，空间 <code>O(n)</code>。"] },
    { t: "省掉两个数组", body: ["用 <code>l</code>、<code>r</code> 从两端往中间走，同时维护 <code>leftMax</code>、<code>rightMax</code>。", "如果 <code>leftMax &lt; rightMax</code>，那么 <code>l</code> 这一格的水位一定是 <code>leftMax</code>：右边至少有一根柱子不低于它。这一格算完，<code>l</code> 右移。另一边同理。"] },
  ],
  codes: [{ t: "标准解法：双指针", code: `
class Solution:
    def trap(self, height: List[int]) -> int:
        l, r = 0, len(height) - 1       #@init
        left_max = right_max = 0        #@init
        water = 0                       #@init
        while l < r:
            left_max = max(left_max, height[l])     #@left,right
            right_max = max(right_max, height[r])   #@left,right
            if left_max < right_max:    # 左边矮，l 这一格水位就是 left_max #@left
                water += left_max - height[l]   #@left
                l += 1                  #@left
            else:                       #@right
                water += right_max - height[r]  #@right
                r -= 1                  #@right
        return water                    #@done
` }, { t: "简洁写法：前缀最大值", key: "prefix", kind: "elegant", note: "每个位置能接的水 = min(左边最高, 右边最高) − 自己的高度。用 accumulate 一次算出两个方向的最高。", code: `
from itertools import accumulate

class Solution:
    def trap(self, height: List[int]) -> int:
        left = accumulate(height, max)  #@left
        right = list(accumulate(reversed(height), max))[::-1]  #@right
        return sum(min(l, r) - h for l, r, h in zip(left, right, height))  #@each,done
` }, { t: "另一种写法：单调栈，按层接水", key: "stack", note: "栈里的柱子从底到顶越来越矮。来了一根更高的柱子，栈顶就是一个坑的坑底，它下面那根是左墙，新柱子是右墙，一次接上一层水。", code: `
class Solution:
    def trap(self, height: List[int]) -> int:
        stack, water = [], 0                # 栈里存下标，高度从底到顶递减 #@init
        for i, h in enumerate(height):
            while stack and height[stack[-1]] < h:  #@nowall,fill
                bottom = stack.pop()        # 坑底 #@nowall,fill
                if not stack:               #@nowall
                    break                   # 左边没有墙，接不住 #@nowall
                left = stack[-1]            #@fill
                width = i - left - 1        #@fill
                water += (min(height[left], h) - height[bottom]) * width    #@fill
            stack.append(i)                 #@push
        return water                        #@done
` }],
  sig: { fn: "trap", params: ["int[]"], ret: "int" },
  call: (a) => [a.h],
  cases: [[[1]], [[3, 0, 3]], [[5, 4, 1, 2]], [[0, 0, 0]]],
  pytest: `
s = Solution()
assert s.trap([0,1,0,2,1,0,1,3,2,1,2,1]) == 6
assert s.trap([4,2,0,3,2,5]) == 9
assert s.trap([1]) == 0
assert s.trap([3,0,3]) == 3
`,
  method: "双指针",
  legend: [["a", "当前指针 l / r"], ["b", "水位确定的一侧（较矮侧）"], ["d", "已经算完的格子"], ["wat", "已确定的水"]],
  presets: [
    { label: "示例 1", args: { h: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] }, note: "height = [0,1,0,2,1,0,1,3,2,1,2,1]", expect: 6 },
    { label: "示例 2", args: { h: [4, 2, 0, 3, 2, 5] }, note: "height = [4,2,0,3,2,5]", expect: 9 },
  ],
  build(a, snap) {
    const h = a.h, n = h.length, w = new Array(n).fill(0);
    let l = 0, r = n - 1, lm = 0, rm = 0, total = 0;
    const view = (done, active = -1) => [{
      t: "bars",
      label: "height",
      items: h.map((v, i) => ({
        v,
        water: w[i],
        cls: !done && i === active ? "b" : !done && (i === l || i === r) ? "a" : i < l || i > r || done ? "d" : "",
      })),
      ptrs: done ? {} : { l, r },
    }];
    snap("开始", "l、r 从两端出发。leftMax 是 l 走过的最高柱子，rightMax 是 r 走过的最高柱子。", view(false), {
      at: "init",
      facts: [["积水总量", 0], ["leftMax", 0], ["rightMax", 0]],
    });
    while (l < r) {
      const prevLm = lm, prevRm = rm, prevTotal = total;
      lm = Math.max(lm, h[l]);
      rm = Math.max(rm, h[r]);
      if (lm < rm) {
        const add = lm - h[l];
        w[l] = add;
        total += add;
        snap(
          "算左边这一格",
          `leftMax (${lm}) &lt; rightMax (${rm})：右边至少有 ${rm} 高的柱子兜底，所以左边下标 ${l} 的水位一定由更矮的 leftMax = ${lm} 决定。接水 ${lm} − ${h[l]} = <b>${add}</b>，l 右移（${l} → ${l + 1}）。`,
          view(false, l),
          { at: "left", facts: [["积水总量", total, prevTotal], ["leftMax", lm, prevLm], ["rightMax", rm, prevRm]] },
        );
        l++;
      } else {
        const add = rm - h[r];
        w[r] = add;
        total += add;
        snap(
          "算右边这一格",
          `rightMax (${rm}) ≤ leftMax (${lm})：左边至少有 ${lm} 高的柱子兜底，所以右边下标 ${r} 的水位一定由较矮的 rightMax = ${rm} 决定。接水 ${rm} − ${h[r]} = <b>${add}</b>，r 左移（${r} → ${r - 1}）。`,
          view(false, r),
          { at: "right", facts: [["积水总量", total, prevTotal], ["leftMax", lm, prevLm], ["rightMax", rm, prevRm]] },
        );
        r--;
      }
    }
    snap("完成", `两个指针相遇。一共接到 <b>${total}</b> 格水。`, view(true), {
      at: "done",
      kind: "ok",
      ans: total,
      facts: [["积水总量", total], ["leftMax", lm], ["rightMax", rm]],
    });
  },
  alts: [{
    t: "前缀最大值",
    code: "prefix",
    note: "和简洁写法一样：每一格的水位 = min(左边最高, 右边最高)。先从左往右、从右往左各算一遍最高值，再逐格相减。要 O(n) 额外空间。",
    legend: [["a", "当前格子"], ["k", "两边最高里较小的那个，就是这一格的水位"], ["wat", "接到的水"]],
    build(a, snap) {
      const h = a.h, n = h.length, w = Array(n).fill(0), L = Array(n).fill(null), R = Array(n).fill(null);
      let total = 0, prevLv = "—", prevAdd = "—";
      const view = (i) => [
        { t: "bars", label: "height", items: h.map((v, k) => ({ v, water: w[k], cls: k === i ? "a" : "" })) },
        { t: "array", label: "left：从左往右到这里为止最高的柱子", items: L.map((v, k) => ({ v: v === null ? "" : v, cls: k === i && L[k] <= R[k] ? "k" : "" })) },
        { t: "array", label: "right：从右往左到这里为止最高的柱子", items: R.map((v, k) => ({ v: v === null ? "" : v, cls: k === i && R[k] < L[k] ? "k" : "" })) },
      ];
      snap("开始", "一格能接多少水，取决于它左边最高和右边最高的柱子里较矮的那根。先把两个方向的最高都算出来。", view(-1), {
        at: [],
        facts: [["积水总量", 0], ["min(L, R)", "—"], ["本格接水", "—"]],
      });
      for (let k = 0; k < n; k++) L[k] = Math.max(k ? L[k - 1] : 0, h[k]);
      snap("算 left", "accumulate(height, max)：从左往右走，每格记下到这里为止（包括自己）最高的柱子。", view(-1), {
        at: "left",
        facts: [["积水总量", 0], ["min(L, R)", "—"], ["本格接水", "—"]],
      });
      for (let k = n - 1; k >= 0; k--) R[k] = Math.max(k < n - 1 ? R[k + 1] : 0, h[k]);
      snap("算 right", "再从右往左走一遍，每格记下它右边（包括自己）最高的柱子。", view(-1), {
        at: "right",
        facts: [["积水总量", 0], ["min(L, R)", "—"], ["本格接水", "—"]],
      });
      for (let i = 0; i < n; i++) {
        const lv = Math.min(L[i], R[i]), add = lv - h[i], prevTotal = total;
        w[i] = add;
        total += add;
        snap(`下标 ${i}`, `left = ${L[i]}，right = ${R[i]}，水位是较小的 ${lv}。这一格接 ${lv} − ${h[i]} = <b>${add}</b>。`, view(i), {
          at: "each",
          facts: [["积水总量", total, prevTotal], ["min(L, R)", lv, prevLv], ["本格接水", add, prevAdd]],
        });
        prevLv = lv;
        prevAdd = add;
      }
      snap("完成", `每一格都算完了，一共接到 <b>${total}</b> 格水。`, view(-1), {
        kind: "ok",
        ans: total,
        at: "done",
        facts: [["积水总量", total]],
      });
    },
  }, {
    t: "单调栈",
    code: "stack",
    note: "和「另一种写法」一样：前面两种是一列一列算水，这种是一层一层算。栈里的柱子从底到顶越来越矮；来了更高的柱子，就和栈里的柱子围出一个坑，接上一层水。",
    legend: [["a", "右墙：当前柱子"], ["b", "坑底"], ["k", "左墙"], ["e", "在栈里"], ["wat", "接到的水"]],
    build(a, snap) {
      const h = a.h, n = h.length, level = h.slice(), stack = [];
      let total = 0;
      const view = (i, bottom, left) => [
        { t: "bars", label: "height", items: h.map((v, k) => ({ v, water: level[k] - v, cls: k === i ? "a" : k === bottom ? "b" : k === left ? "k" : stack.includes(k) ? "e" : "" })), ptrs: { i: i >= 0 && i < n ? i : null } },
        { t: "chips", label: "栈（存下标，右边是栈顶）", items: stack.map((k) => `${k}:${h[k]}`), empty: "空" },
      ];
      snap("开始", "从左往右看每根柱子。栈里放还在等右墙的柱子，高度从底到顶递减。", view(-1, -1, -1), {
        at: "init",
        facts: [["积水总量", 0], ["栈大小", 0]],
      });
      for (let i = 0; i < n; i++) {
        while (stack.length && h[stack[stack.length - 1]] < h[i]) {
          const prevStackLen = stack.length;
          const bottom = stack.pop();
          if (!stack.length) {
            snap("左边没墙", `${h[i]} 比栈顶的 ${h[bottom]} 高，弹出 ${bottom}。可它左边没有柱子了，围不成坑，接不住水。`, view(i, bottom, -1), {
              kind: "warn",
              at: "nowall",
              facts: [["积水总量", total], ["栈大小", stack.length, prevStackLen]],
            });
            break;
          }
          const left = stack[stack.length - 1], width = i - left - 1, top = Math.min(h[left], h[i]), add = (top - h[bottom]) * width;
          const prevTotal = total;
          for (let k = left + 1; k < i; k++) level[k] = top;
          total += add;
          snap("接一层水", `${h[i]} 比栈顶的 ${h[bottom]} 高，弹出坑底 ${bottom}。左墙是下标 ${left}（高 ${h[left]}），右墙是 ${i}（高 ${h[i]}）。这一层宽 ${i} − ${left} − 1 = ${width}，高 min(${h[left]}, ${h[i]}) − ${h[bottom]} = ${top - h[bottom]}，接 <b>${add}</b>。`, view(i, bottom, left), {
            at: "fill",
            facts: [["积水总量", total, prevTotal], ["栈大小", stack.length, prevStackLen], ["本层接水", add]],
          });
        }
        const prevStackLen = stack.length;
        stack.push(i);
        snap("压栈", `把下标 ${i}（高 ${h[i]}）压栈，等它的右墙。`, view(i, -1, -1), {
          at: "push",
          facts: [["积水总量", total], ["栈大小", stack.length, prevStackLen]],
        });
      }
      snap("完成", `所有柱子都看完了，一共接到 <b>${total}</b> 格水。`, view(-1, -1, -1), {
        kind: "ok",
        ans: total,
        at: "done",
        facts: [["积水总量", total], ["栈大小", stack.length]],
      });
    },
  }],
  points: [
    { t: "先更新最高值再算水", body: "先把当前柱子计入 leftMax / rightMax，这样 <code>leftMax − height[l]</code> 不会是负数。" },
    { t: "为什么矮的那边可以先算", body: "leftMax < rightMax 时，l 右边一定存在不低于 leftMax 的柱子，所以 l 这格的水位不会被右边限制。" },
    { t: "复杂度", body: "双指针时间 O(n)、空间 O(1)；前缀最大值和单调栈都是时间 O(n)、空间 O(n)。" },
  ],
};
