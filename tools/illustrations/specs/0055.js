module.exports = {
  id: 55, name: "跳跃游戏", title: "跳跃游戏图解", level: "中等", topic: "贪心算法",
  h1: "跳跃游戏，只记能到的最远位置",
  lede: "不用关心具体怎么跳。从左往右走，一直记着「目前能到的最远下标」。只要当前位置还在这个范围内，就用它更新最远位置；走到一个够不着的位置，就说明到不了终点。",
  hints: [
    { t: "能到的位置是连续的", body: ["如果能到下标 <code>j</code>，那么 <code>j</code> 左边的每个位置也都能到（跳的时候少跳一点就行）。", "所以只需要记一个数：能到的最远下标 <code>far</code>。"] },
    { t: "怎么更新 far", body: ["站在位置 <code>i</code>（前提是 <code>i &lt;= far</code>），最远能跳到 <code>i + nums[i]</code>。", "<code>far = max(far, i + nums[i])</code>。"] },
    { t: "什么时候失败", body: ["走到某个 <code>i &gt; far</code>，说明连 <code>i</code> 都到不了，更别说终点。", "<code>far</code> 一旦 ≥ 最后一个下标，就可以提前返回 True。"] },
  ],
  codes: [{ t: "标准解法：贪心，维护最远可达", code: `
class Solution:
    def canJump(self, nums: List[int]) -> bool:
        far = 0                             # 目前能到的最远下标 #@init
        for i, x in enumerate(nums):
            if i > far:                     # 连 i 都到不了 #@bad
                return False                #@bad
            far = max(far, i + x)           #@grow
            if far >= len(nums) - 1:        #@grow,reach
                return True                 #@reach
        return True
` }, { t: "简洁写法：从终点往回推", key: "goal", kind: "elegant", note: "goal 是「只要能到这里就能到终点」的最左位置。从右往左看，能跳到 goal 的位置就成为新的 goal。", code: `
class Solution:
    def canJump(self, nums: List[int]) -> bool:
        goal = len(nums) - 1            #@init
        for i in range(len(nums) - 2, -1, -1):
            if i + nums[i] >= goal:     #@move,stay
                goal = i                #@move
        return goal == 0                #@done
` }],
  sig: { fn: "canJump", params: ["int[]"], ret: "bool" },
  call: (a) => [a.nums],
  cases: [[[0]], [[0, 1]], [[2, 0, 0]], [[1, 0, 1, 0]], [[2, 5, 0, 0]]],
  pytest: `
s = Solution()
assert s.canJump([2,3,1,1,4]) is True
assert s.canJump([3,2,1,0,4]) is False
assert s.canJump([0]) is True
assert s.canJump([0,1]) is False
assert s.canJump([2,0,0]) is True
`,
  method: "维护最远可达",
  legend: [["e", "能到的范围"], ["a", "当前位置"], ["w", "到不了"], ["c", "终点能到"]],
  presets: [
    { label: "示例 1", args: { nums: [2, 3, 1, 1, 4] }, note: "nums = [2,3,1,1,4]", expect: true },
    { label: "示例 2", args: { nums: [3, 2, 1, 0, 4] }, note: "nums = [3,2,1,0,4]", expect: false },
  ],
  build(a, snap) {
    const nums = a.nums.slice(), n = nums.length;
    let far = 0;
    const view = (i, end, opts = {}) => [{
      t: "array",
      label: "nums",
      items: nums.map((v, k) => ({
        v,
        cls: end === "ok" && k === n - 1 ? "c" : k === i ? (end === "bad" ? "w" : "a") : k <= far ? "e" : end === "bad" ? "w" : "",
      })),
      ptrs: { i: i >= 0 ? i : null, far: Math.min(far, n - 1) },
      feeds: opts.feeds || [],
    }];
    const f = (prevFar) => ({ facts: [["最远可达 far", far, prevFar], ["终点", n - 1]] });
    snap("开始", "一开始站在下标 0，能到的最远位置 far = 0。", view(-1, null), { at: "init", ...f() });
    for (let i = 0; i < n; i++) {
      if (i > far) {
        snap("到不了", `下标 ${i} &gt; far = ${far}，连这里都到不了，终点更到不了。返回 <b>false</b>。`, view(i, "bad"), { at: "bad", kind: "warn", ans: false, ...f() });
        return;
      }
      const old = far, reach = i + nums[i], improved = reach > old;
      far = Math.max(far, reach);
      const to = Math.min(n - 1, reach);
      const feeds = to > i ? [{ from: i, to, win: improved, label: `+${nums[i]}` }] : [];
      if (far >= n - 1) {
        snap("能到终点", `站在 ${i}，最远能跳到 ${i} + ${nums[i]} = ${reach}，已经够到终点 ${n - 1}。返回 <b>true</b>。`, view(i, "ok", { feeds }), { at: ["grow", "reach"], kind: "ok", ans: true, ...f(old) });
        return;
      }
      snap(
        "更新 far",
        `站在 ${i}，最远能跳到 ${i} + ${nums[i]} = ${reach}。` + (improved ? `far 从 ${old} 变成 <b>${far}</b>。` : `没有超过 far = ${far}。`),
        view(i, null, { feeds }),
        { at: "grow", ...f(old) },
      );
    }
  },
  alts: [{
    t: "从终点往回推",
    code: "goal",
    note: "和简洁写法一样：goal 是「只要能到这里，就一定能到终点」的最左位置。从右往左看，能跳到 goal 的位置就成为新的 goal，最后看 goal 是不是 0。",
    legend: [["a", "当前位置"], ["e", "从这里出发能到终点"], ["w", "到不了终点"], ["c", "起点能到终点"]],
    build(a, snap) {
      const nums = a.nums.slice(), n = nums.length;
      let goal = n - 1;
      const view = (i, end, opts = {}) => [{
        t: "array",
        label: "nums",
        items: nums.map((v, k) => ({
          v,
          cls: k === i ? "a" : k >= goal ? (end === "ok" && k === 0 ? "c" : "e") : end === "bad" ? "w" : "",
        })),
        ptrs: { i: i >= 0 ? i : null, goal },
        feeds: opts.feeds || [],
      }];
      const f = (i, prevGoal) => ({
        facts: [
          ["当前下标 i", i >= 0 ? i : "—"],
          ["目标 goal", goal, prevGoal],
          ["终点", n - 1],
        ],
      });
      snap("开始", `goal 一开始就是终点 ${n - 1}：站在终点当然能到终点。从倒数第二格开始往左看。`, view(-1, null), { at: "init", ...f(-1) });
      for (let i = n - 2; i >= 0; i--) {
        const reach = i + nums[i], canReach = reach >= goal;
        const to = Math.min(n - 1, reach);
        const feeds = to > i ? [{ from: i, to, win: canReach, label: `+${nums[i]}` }] : [];
        if (canReach) {
          const old = goal;
          goal = i;
          snap("新的 goal", `站在 ${i} 最远能跳到 ${i} + ${nums[i]} = ${reach}，够得着 goal = ${old}。能到 ${i} 就能到终点，goal 移到 <b>${i}</b>。`, view(i, null, { feeds }), { at: "move", ...f(i, old) });
        } else {
          snap("够不着", `站在 ${i} 最远只能跳到 ${i} + ${nums[i]} = ${reach}，够不着 goal = ${goal}。goal 不动。`, view(i, null, { feeds }), { at: "stay", ...f(i) });
        }
      }
      if (goal === 0) snap("完成", "goal 推到了起点 0，从起点出发能到终点。返回 <b>true</b>。", view(-1, "ok"), { at: "done", kind: "ok", ans: true, ...f(-1) });
      else snap("完成", `goal 停在 ${goal}，没能推到起点。起点到不了终点，返回 <b>false</b>。`, view(-1, "bad"), { at: "done", kind: "warn", ans: false, ...f(-1) });
    },
  }],
  points: [
    { t: "先判断再更新", body: "<code>i &gt; far</code> 的判断要放在更新之前。位置 i 都到不了，就不能用 nums[i] 更新 far。" },
    { t: "不需要真的模拟跳", body: "只关心能不能到，不关心跳几次、怎么跳，一个变量就够了。" },
    { t: "复杂度", body: "一遍扫描，时间 O(n)，空间 O(1)。" },
  ],
};
