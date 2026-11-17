"""Disposable Pyodide judge. Programs receive only virtual stdin/stdout and node helpers."""
import json as _practice_json
import io as _practice_io
import sys as _practice_sys
import contextlib as _practice_contextlib


def __practice_run(request_json):
    request = _practice_json.loads(request_json)
    signature, case = request["signature"], request["test"]

    class Output(_practice_io.StringIO):
        def write(self, text):
            if self.tell() + len(text) > 16384:
                raise RuntimeError("标准输出超过 16 KB，请减少调试输出")
            return super().write(text)

    class ListNode:
        def __init__(self, val=0, next=None):
            self.val, self.next = val, next

    class TreeNode:
        def __init__(self, val=0, left=None, right=None):
            self.val, self.left, self.right = val, left, right

    class Node:
        def __init__(self, val=0, next=None, random=None):
            self.val, self.next, self.random = val, next, random

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
    try:
        _practice_sys.stdin = _practice_io.StringIO(case.get("stdin", ""))
        with _practice_contextlib.redirect_stdout(stdout), _practice_contextlib.redirect_stderr(stdout):
            exec(compile(request["code"], "solution.py", "exec"), namespace)
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
    except BaseException as exc:
        error = f"{type(exc).__name__}: {exc}"
    finally:
        _practice_sys.stdin = previous_stdin
    try:
        result = _practice_json.dumps({"actual": actual, "stdout": stdout.getvalue(), **({"error": error} if error else {})}, allow_nan=False)
        if len(result) > 1000000:
            raise ValueError("返回结果过大")
        return result
    except BaseException as exc:
        return _practice_json.dumps({"actual": None, "stdout": stdout.getvalue(), "error": f"结果无法序列化: {exc}"})
