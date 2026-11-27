import assert from "node:assert/strict";
import { DapClient, DapConnectError, defaultEntryLine, type DapSnapshot } from "../dap-client.ts";

// —— 1. defaultEntryLine tests ——
{
  const javaLc = [
    "import java.util.*;",
    "class Solution {",
    "    public int[] twoSum(int[] nums, int target) {",
    "        Map<Integer, Integer> map = new HashMap<>();",
    "        return new int[]{0, 1};",
    "    }",
    "}",
  ].join("\n");
  assert.equal(defaultEntryLine(javaLc, "java", "leetcode"), 4);

  const goAcm = [
    "package main",
    "import (",
    '  "fmt"',
    ")",
    "func main() {",
    "  x := 1",
    "  fmt.Println(x)",
    "}",
  ].join("\n");
  assert.equal(defaultEntryLine(goAcm, "go", "acm"), 6);

  const cppLc = [
    "#include <vector>",
    "using namespace std;",
    "class Solution {",
    "public:",
    "    vector<int> twoSum(vector<int>& nums, int target) {",
    "        int n = nums.size();",
    "        return {};",
    "    }",
    "};",
  ].join("\n");
  assert.equal(defaultEntryLine(cppLc, "cpp", "leetcode"), 6);

  const pyLc = [
    "class Solution:",
    "    def twoSum(self, nums: List[int], target: int) -> List[int]:",
    "        seen = {}",
    "        return []",
  ].join("\n");
  assert.equal(defaultEntryLine(pyLc, "python", "leetcode"), 3);

  const tsLc = [
    "function twoSum(nums: number[], target: number): number[] {",
    "    const m = new Map<number, number>();",
    "    return [];",
    "}",
  ].join("\n");
  assert.equal(defaultEntryLine(tsLc, "typescript", "leetcode"), 2);

  const rustLc = [
    "impl Solution {",
    "    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {",
    "        let mut ans = vec![];",
    "        ans",
    "    }",
    "}",
  ].join("\n");
  assert.equal(defaultEntryLine(rustLc, "rust", "leetcode"), 3);

  const rubyAcm = [
    "# read line",
    "a, b = gets.split.map(&:to_i)",
    "puts a + b",
  ].join("\n");
  assert.equal(defaultEntryLine(rubyAcm, "ruby", "acm"), 2);

  const phpAcm = [
    "<?php",
    "fscanf(STDIN, '%d %d', $a, $b);",
    "echo $a + $b;",
  ].join("\n");
  assert.equal(defaultEntryLine(phpAcm, "php", "acm"), 2);

  const ktLc = [
    "class Solution {",
    "    fun twoSum(nums: IntArray, target: Int): IntArray {",
    "        val m = HashMap<Int, Int>()",
    "        return intArrayOf()",
    "    }",
    "}",
  ].join("\n");
  assert.equal(defaultEntryLine(ktLc, "kotlin", "leetcode"), 3);

  const dartAcm = [
    "import 'dart:io';",
    "void main() {",
    "  final line = stdin.readLineSync();",
    "}",
  ].join("\n");
  assert.equal(defaultEntryLine(dartAcm, "dart", "acm"), 3);
}

// —— 2. DapClient mock WebSocket tests ——
type Listener = (ev: { data?: string }) => void;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  url: string;
  sent: Record<string, unknown>[] = [];
  private listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, fn: Listener) {
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }

  emit(type: string, data?: unknown) {
    for (const fn of this.listeners.get(type) ?? []) {
      fn(data === undefined ? {} : { data: typeof data === "string" ? data : JSON.stringify(data) });
    }
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.emit("open");
  }

  send(raw: string) {
    const msg = JSON.parse(raw) as Record<string, unknown>;
    this.sent.push(msg);
    this.onSend?.(msg);
  }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close");
  }

  onSend?: (msg: Record<string, unknown>) => void;
}

// Provide global WebSocket.OPEN constant for DapClient checks
(globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

const flush = () => new Promise((r) => setTimeout(r, 15));

// Scenario A: full DAP handshake + stopped + locals + watch evaluate + dynamic setWatch + setBreakpoints + next + continue + terminated
{
  MockWebSocket.instances = [];
  const snapshots: DapSnapshot[] = [];
  let evalCount = 0;
  let stepIdx = 0;

  const client = new DapClient({
    url: "wss://example.test/api/dap?lang=go",
    lang: "go",
    mode: "leetcode",
    code: "func twoSum(nums []int, target int) []int {\n  x := nums[0]\n  return []int{x}\n}",
    label: "示例 1",
    breakpoints: [],
    watch: ["nums[0]", "x + 1"],
    onUpdate: (s) => snapshots.push(s),
    WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
  });

  const ws = MockWebSocket.instances[0];
  ws.onSend = (msg) => {
    if (msg.type === "init") {
      ws.emit("message", { type: "ready", sessionId: "dap-1", lang: "go", mode: "leetcode", sourceName: "solution.go", lines: 4 });
      return;
    }
    const seq = msg.seq as number;
    const cmd = msg.command as string;
    const reply = (body: unknown = {}, success = true, message?: string) =>
      queueMicrotask(() => ws.emit("message", { type: "response", request_seq: seq, command: cmd, success, body, message }));

    if (cmd === "initialize" || cmd === "launch" || cmd === "setBreakpoints") {
      reply({});
    } else if (cmd === "configurationDone") {
      reply({});
      setTimeout(() => {
        ws.emit("message", { type: "event", event: "output", body: { category: "stdout", output: "hello\n" } });
        ws.emit("message", { type: "event", event: "stopped", body: { reason: "breakpoint", threadId: 1 } });
      }, 5);
    } else if (cmd === "stackTrace") {
      reply({
        stackFrames: [
          { id: 10 + stepIdx, name: "twoSum", line: 2 + stepIdx, source: { name: "solution.go" } },
        ],
      });
    } else if (cmd === "scopes") {
      reply({ scopes: [{ name: "Locals", variablesReference: 100 + stepIdx, expensive: false }] });
    } else if (cmd === "variables") {
      reply({
        variables: stepIdx === 0
          ? [{ name: "nums", value: "[]int(2) [2, 7]" }, { name: "x", value: "0" }]
          : [{ name: "nums", value: "[]int(2) [2, 7]" }, { name: "x", value: "2" }],
      });
    } else if (cmd === "evaluate") {
      evalCount++;
      const expr = String((msg.arguments as { expression?: string })?.expression || "");
      if (expr === "nums[0]") reply({ result: "2" });
      else if (expr === "x + 1") reply({ result: stepIdx === 0 ? "1" : "3" });
      else if (expr === "nums[1]") reply({ result: "7" });
      else reply({}, false, "cannot evaluate");
    } else if (cmd === "next") {
      stepIdx = 1;
      reply({});
      setTimeout(() => ws.emit("message", { type: "event", event: "stopped", body: { reason: "step", threadId: 1 } }), 5);
    } else if (cmd === "continue") {
      reply({});
      setTimeout(() => ws.emit("message", { type: "event", event: "terminated", body: {} }), 5);
    }
  };

  ws.open();
  await client.readyPromise;
  await flush();

  const s1 = snapshots.at(-1)!;
  assert.equal(s1.status, "paused");
  assert.equal(s1.line, 2);
  assert.equal(s1.stdout, "hello\n");
  assert.deepEqual(s1.vars, [["nums", "[]int(2) [2, 7]"], ["x", "0"]]);
  assert.equal(s1.watches.find((w) => w.expr === "nums[0]")?.value, "2");
  assert.equal(s1.watches.find((w) => w.expr === "x + 1")?.value, "1");

  // Add a watch expression while paused -> evaluates immediately
  await client.setWatch(["nums[0]", "x + 1", "nums[1]", "badExpr"]);
  const sWatch = snapshots.at(-1)!;
  assert.equal(sWatch.watches.find((w) => w.expr === "nums[1]")?.value, "7");
  assert.equal(sWatch.watches.find((w) => w.expr === "badExpr")?.error, "cannot evaluate");

  // Live breakpoint update
  await client.setBreakpoints([3]);
  assert.ok(ws.sent.some((m) => m.command === "setBreakpoints" && ((m.arguments as { breakpoints: { line: number }[] }).breakpoints[0]?.line === 3)));

  // Step over -> x changes from 0 to 2, x + 1 changes from 1 to 3
  await client.next();
  await flush();
  const s2 = snapshots.at(-1)!;
  assert.equal(s2.status, "paused");
  assert.equal(s2.line, 3);
  assert.deepEqual(s2.changed, ["x"]);
  const xPlusOne = s2.watches.find((w) => w.expr === "x + 1")!;
  assert.equal(xPlusOne.value, "3");
  assert.equal(xPlusOne.history.length, 2);
  assert.ok(evalCount >= 6);

  // Continue -> terminated
  await client.continue();
  await flush();
  assert.equal(snapshots.at(-1)!.status, "terminated");
}

// Scenario B: compile_error rejects readyPromise with DapConnectError.compileError === true
{
  MockWebSocket.instances = [];
  const snapshots: DapSnapshot[] = [];
  const client = new DapClient({
    url: "wss://example.test/api/dap?lang=cpp",
    lang: "cpp",
    mode: "acm",
    code: "int main() { broken }",
    label: "示例 1",
    breakpoints: [1],
    watch: [],
    onUpdate: (s) => snapshots.push(s),
    WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
  });
  const ws = MockWebSocket.instances[0];
  ws.onSend = (msg) => {
    if (msg.type === "init") {
      ws.emit("message", { type: "compile_error", compileError: "expected ';'", error: "编译出错：\nexpected ';'" });
    }
  };
  ws.open();
  await assert.rejects(
    () => client.readyPromise,
    (err: unknown) => err instanceof DapConnectError && err.compileError === true && /expected ';'/.test(err.message),
  );
  assert.equal(snapshots.at(-1)!.status, "error");
}

console.log("DAP client tests passed");
