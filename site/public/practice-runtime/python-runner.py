"""Disposable Pyodide judge. Programs receive only virtual stdin/stdout and node helpers."""
import json as _practice_json
import io as _practice_io
import sys as _practice_sys
import contextlib as _practice_contextlib
import traceback as _practice_traceback
import reprlib as _practice_reprlib
import types as _practice_types

# 调试（trace）：用 sys.settrace 记下用户代码（solution.py）每执行一行时的局部变量，最多记这么多步；
# 不需要让程序真的停下来，页面在记录上前进、后退、跳到断点。
_PRACTICE_TRACE_LIMIT = 1000
_PRACTICE_TRACE_BYTES = 600000


def _practice_short_repr():
    class Short(_practice_reprlib.Repr):
        # Counter、defaultdict、OrderedDict 这些 dict / list / set 的子类：reprlib 默认把整串 repr 从中间截掉
        # （「Counter({'A': 1, 'B'..., 'E': -2})」），这里按容器缩短，前面带上类型名：Counter({'A': 1, 'B': 2, …})
        def repr_instance(self, x, level):
            for base, method in ((dict, self.repr_dict), (list, self.repr_list), (set, self.repr_set), (frozenset, self.repr_frozenset), (tuple, self.repr_tuple)):
                if isinstance(x, base):
                    try:
                        return f"{type(x).__name__}({method(base(x), level)})"
                    except BaseException:
                        break
            try:
                s = repr(x)
            except BaseException:
                return "<无法显示>"
            return s if len(s) <= self.maxother else s[: self.maxother - 1] + "…"

        # 长字符串截掉后面，留开头（默认是两头留、中间截）
        def repr_str(self, x, level):
            s = repr(x[: self.maxstring])
            return s if len(x) <= self.maxstring else s[:-1] + "…" + s[-1]

    r = Short()
    r.fillvalue = "…"
    r.maxlevel, r.maxstring, r.maxother, r.maxlong = 3, 60, 60, 40
    r.maxlist = r.maxtuple = r.maxdeque = r.maxarray = 12
    r.maxdict = r.maxset = r.maxfrozenset = 10
    return r


class _PracticeStepLimit(BaseException):
    """调试记满了步数：从用户代码里抛出来，让程序停下（用 BaseException，一般的 except Exception 拦不住）。"""


def __practice_run(request_json):
    request = _practice_json.loads(request_json)
    signature, case = request["signature"], request["test"]
    tracing = bool(request.get("trace"))

    class Output(_practice_io.StringIO):
        def write(self, text):
            if self.tell() + len(text) > 16384:
                raise RuntimeError("标准输出超过 16 KB，请减少调试输出")
            return super().write(text)

    def chain(node, limit=12):
        out, seen = [], set()
        while node is not None and len(out) < limit:
            if id(node) in seen:
                out.append("…（有环）")
                return " → ".join(out)
            seen.add(id(node))
            out.append(repr(node.val))
            node = getattr(node, "next", None)
        if node is not None:
            out.append("…")
        return " → ".join(out)

    class ListNode:
        def __init__(self, val=0, next=None):
            self.val, self.next = val, next

        def __repr__(self):
            return f"ListNode({chain(self)})"

    class TreeNode:
        def __init__(self, val=0, left=None, right=None):
            self.val, self.left, self.right = val, left, right

        def __repr__(self):
            return f"TreeNode({self.val!r})"

    class Node:
        def __init__(self, val=0, next=None, random=None):
            self.val, self.next, self.random = val, next, random

        def __repr__(self):
            return f"Node({self.val!r})"

    nodes, old_random, tree = [], set(), None

    def make_list(values):
        dummy = cur = ListNode()
        for value in values:
            cur.next = ListNode(value)
            cur = cur.next
            nodes.append(cur)
        return dummy.next

    def make_tree(values):
        if not values or values[0] is None:
            return None
        root = TreeNode(values[0])
        queue, i, h = [root], 1, 0
        while h < len(queue) and i < len(values):
            node = queue[h]
            h += 1
            for side in ("left", "right"):
                if i == len(values):
                    break
                value = values[i]
                i += 1
                if value is not None:
                    child = TreeNode(value)
                    setattr(node, side, child)
                    queue.append(child)
        return root

    def incoming(kind, value):
        nonlocal tree
        if kind == "ListNode":
            return make_list(value)
        if kind == "ListNode[]":
            return [make_list(v) for v in value]
        if kind == "CycleList":
            start, head = len(nodes), make_list(value[0])
            if head is not None and value[1] is not None and value[1] >= 0:
                nodes[-1].next = nodes[start + value[1]]
            return head
        if kind == "JoinList":
            tail = nodes[value[1]] if value[1] is not None and value[1] >= 0 else None
            head = make_list(value[0])
            if head is None:
                return tail
            nodes[-1].next = tail
            return head
        if kind == "TreeNode":
            tree = make_tree(value)
            return tree
        if kind == "TreeRef":
            queue = [tree]
            while queue:
                node = queue.pop()
                if node is None:
                    continue
                if node.val == value:
                    return node
                queue.extend((node.left, node.right))
            return None
        if kind == "RandomList":
            made = [Node(v) for v, _ in value]
            for i, node in enumerate(made):
                old_random.add(id(node))
                node.next = made[i + 1] if i + 1 < len(made) else None
                node.random = made[value[i][1]] if value[i][1] is not None else None
            return made[0] if made else None
        return _practice_json.loads(_practice_json.dumps(value))

    def outgoing(kind, value):
        if kind == "ListNode":
            out, seen = [], set()
            while value is not None:
                if id(value) in seen or len(out) > 100000:
                    raise ValueError("输出链表存在环或过长")
                seen.add(id(value))
                out.append(value.val)
                value = value.next
            return out
        if kind == "TreeNode":
            out, queue, seen, i = [], [value], set(), 0
            while i < len(queue):
                node = queue[i]
                i += 1
                if node is None:
                    out.append(None)
                    continue
                if id(node) in seen or len(queue) > 100000:
                    raise ValueError("输出不是有限二叉树")
                seen.add(id(node))
                out.append(node.val)
                queue.extend((node.left, node.right))
            while out and out[-1] is None:
                out.pop()
            return out
        if kind == "NodeIndex":
            if value is None:
                return None
            for i, node in enumerate(nodes):
                if node is value:
                    return i
            raise ValueError("返回节点不属于输入链表")
        if kind == "TreeVal":
            return None if value is None else value.val
        if kind == "RandomList":
            made, seen = [], {}
            while value is not None:
                if id(value) in seen or len(made) > 100000:
                    raise ValueError("输出随机链表存在环")
                if id(value) in old_random:
                    raise ValueError("应深拷贝链表，不能返回原节点")
                seen[id(value)] = len(made)
                made.append(value)
                value = value.next
            out = []
            for node in made:
                if node.random is not None and id(node.random) not in seen:
                    raise ValueError("random 指向输出链表之外")
                out.append([node.val, None if node.random is None else seen[id(node.random)]])
            return out
        return value

    namespace = {"ListNode": ListNode, "TreeNode": TreeNode, "Node": Node, "_Node": Node, "__name__": "__main__"}
    exec("from typing import *\nfrom collections import *\nfrom functools import *\nfrom itertools import *\nfrom math import *\nfrom heapq import *\nfrom bisect import *\nimport collections, functools, itertools, math, heapq, bisect, random", namespace)
    stdout, previous_stdin = Output(), _practice_sys.stdin
    actual, error = None, None

    # —— 调试记录 ——
    steps, trace_state = [], {"bytes": 0, "full": False}
    short = _practice_short_repr()
    builtin_names = set(namespace)  # 预先导入的名字，ACM 模式的模块级变量里不显示

    def show(value):
        try:
            return short.repr(value)
        except BaseException:
            return "<无法显示>"

    def visible(frame):
        out, module = [], frame.f_code.co_name == "<module>"
        for name, value in list(frame.f_locals.items()):
            if name.startswith("__") or (module and name in builtin_names):
                continue
            if isinstance(value, (_practice_types.ModuleType, _practice_types.FunctionType, _practice_types.BuiltinFunctionType, type)):
                continue
            if name == "self" and isinstance(getattr(value, "__dict__", None), dict):
                # self 本身只是「某某 object at 0x…」：设计类题（LRU 缓存这类）把它的字段一个个列出来，空的 Solution 就不列
                for key, item in list(vars(value).items())[:12]:
                    out.append([f"self.{key}", show(item)])
                continue
            out.append([name, show(value)])
            if len(out) >= 40:
                break
        return out

    def stack_of(frame):
        names = []
        while frame is not None:
            if frame.f_code.co_filename == "solution.py":
                names.append([frame.f_code.co_name, frame.f_lineno])
            frame = frame.f_back
        return names[::-1]

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != "solution.py":
            return None  # 只记用户的代码，判题器和库函数里不进去
        if event not in ("line", "return", "exception"):
            return tracer
        if trace_state["full"]:
            if event == "line":
                raise _PracticeStepLimit()
            return tracer
        step = {"line": frame.f_lineno, "event": event, "fn": frame.f_code.co_name, "stack": stack_of(frame), "vars": visible(frame), "out": stdout.tell()}
        if event == "return":
            step["ret"] = show(arg)
        elif event == "exception":
            step["exc"] = f"{getattr(arg[0], '__name__', 'Exception')}: {show(arg[1])}"
        steps.append(step)
        trace_state["bytes"] += len(_practice_json.dumps(step, ensure_ascii=False))
        if len(steps) >= _PRACTICE_TRACE_LIMIT or trace_state["bytes"] > _PRACTICE_TRACE_BYTES:
            trace_state["full"] = True
            if event == "line":
                raise _PracticeStepLimit()
        return tracer

    try:
        _practice_sys.stdin = _practice_io.StringIO(case.get("stdin", ""))
        with _practice_contextlib.redirect_stdout(stdout), _practice_contextlib.redirect_stderr(stdout):
            # ACM 模式整个程序都是用户写的，从头记；力扣模式从调用 Solution 开始记（不记 class、def 那几行）
            if tracing and request["mode"] != "leetcode":
                _practice_sys.settrace(tracer)
            exec(compile(request["code"], "solution.py", "exec"), namespace)
            if tracing and request["mode"] == "leetcode":
                _practice_sys.settrace(tracer)
            if request["mode"] == "leetcode":
                if signature.get("cls"):
                    ops, argv = case["input"]
                    obj = namespace[signature["cls"]](*[incoming(t, v) for t, v in zip(signature.get("ctor", []), argv[0])])
                    actual = [None]
                    for op, args in zip(ops[1:], argv[1:]):
                        params, ret = signature["methods"][op]
                        method = signature.get("pythonMethods", {}).get(op, op)
                        result = getattr(obj, method)(*[incoming(t, v) for t, v in zip(params, args)])
                        actual.append(None if ret == "void" else outgoing(ret, result))
                else:
                    args = [incoming(t, v) for t, v in zip(signature["params"], case["input"])]
                    method = signature.get("pythonFn", signature["fn"])
                    fn = getattr(namespace["Solution"](), method) if "Solution" in namespace else namespace[method]
                    result = fn(*args)
                    out_index = signature.get("out", 0)
                    actual = outgoing(signature["params"][out_index], args[out_index]) if signature["ret"] == "void" else outgoing(signature["ret"], result)
    except SystemExit as exc:
        if request["mode"] != "acm" or exc.code not in (None, 0):
            error = f"SystemExit: {exc.code}"
    except _PracticeStepLimit:
        actual = None
        error = f"调试最多记录 {_PRACTICE_TRACE_LIMIT} 步，程序停在了这里（没有运行完）。可以换一组小一点的输入再调试"
    except BaseException as exc:
        error = f"{type(exc).__name__}: {exc}"
        # 带上出错的那一行（只看用户代码 solution.py 里的帧；语法错误本身的信息里已经有行号）
        frames = [f for f in _practice_traceback.extract_tb(exc.__traceback__) if f.filename == "solution.py"]
        if frames and not isinstance(exc, SyntaxError):
            last = frames[-1]
            error += f"（第 {last.lineno} 行：{(last.line or '').strip()}）"
    finally:
        _practice_sys.settrace(None)
        _practice_sys.stdin = previous_stdin
    extra = {"trace": {"steps": steps, "truncated": trace_state["full"], "limit": _PRACTICE_TRACE_LIMIT}} if tracing else {}
    try:
        result = _practice_json.dumps({"actual": actual, "stdout": stdout.getvalue(), **({"error": error} if error else {}), **extra}, allow_nan=False)
        if len(result) > 1000000:
            raise ValueError("返回结果过大")
        return result
    except BaseException as exc:
        return _practice_json.dumps({"actual": None, "stdout": stdout.getvalue(), "error": f"结果无法序列化: {exc}"})
