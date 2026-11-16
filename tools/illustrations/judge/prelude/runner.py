
# —— 判题器追加的部分：按签名把 JSON 输入变成参数，调用题解，每个用例输出一行 JSON ——
import json as __json, sys as __sys, copy as __copy

# 本用例建出的节点：要按「是不是同一个节点」判的题用（见 judge/util.js 里的类型说明）
__ctx = {"nodes": [], "tree": None, "made": []}

def __reset():
    __ctx.update(nodes=[], tree=None, made=[])

def __list(vals):
    nodes = [ListNode(v) for v in vals]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    __ctx["nodes"].extend(nodes)
    return nodes

def __find(root, v):
    stack = [root]
    while stack:
        n = stack.pop()
        if n is None: continue
        if n.val == v: return n
        stack += [n.left, n.right]
    return None

def __jin(t, v):
    if t == "ListNode":
        n = __list(v)
        return n[0] if n else None
    if t == "CycleList":
        vals, pos = v
        n = __list(vals)
        if n and pos is not None and pos >= 0: n[-1].next = n[pos]
        return n[0] if n else None
    if t == "JoinList":
        vals, k = v
        tail = __ctx["nodes"][k] if k is not None and k >= 0 else None
        n = __list(vals)
        if not n: return tail
        n[-1].next = tail
        return n[0]
    if t == "TreeNode":
        __ctx["tree"] = T(v)
        return __ctx["tree"]
    if t == "TreeRef": return __find(__ctx["tree"], v)
    if t == "RandomList":
        nodes = [Node(x) for x, _ in v]
        for i, (_, r) in enumerate(v):
            nodes[i].next = nodes[i + 1] if i + 1 < len(nodes) else None
            nodes[i].random = nodes[r] if r is not None else None
        __ctx["made"] = nodes
        return nodes[0] if nodes else None
    if t == "ListNode[]": return [L(x) for x in v]
    return __copy.deepcopy(v)

def __jout(t, v):
    if t == "ListNode": return toL(v)
    if t == "TreeNode": return toT(v)
    if t == "NodeIndex":
        if v is None: return None
        for i, n in enumerate(__ctx["nodes"]):
            if n is v: return i
        return "不是输入里的节点"
    if t == "TreeVal": return None if v is None else v.val
    if t == "RandomList":
        idx, cur = {}, v
        while cur is not None and len(idx) < 100000:
            idx[id(cur)] = len(idx); cur = cur.next
        old = {id(n) for n in __ctx["made"]}
        out, cur = [], v
        while cur is not None and len(out) < 100000:
            if id(cur) in old: return "没有复制：返回了原链表的节点"
            r = cur.random
            out.append([cur.val, None if r is None else idx.get(id(r), "?")])
            cur = cur.next
        return out
    return v

def __jmain():
    spec = __json.loads(open(__sys.argv[1], encoding="utf-8").read())
    sig = spec["sig"]
    for case in spec["cases"]:
        __reset()
        try:
            if sig["kind"] == "design":
                ops, argv = case
                obj = globals()[sig["cls"]](*[__jin(t, v) for t, v in zip(sig["ctor"], argv[0])])
                out = [None]
                for name, a in zip(ops[1:], argv[1:]):
                    m = sig["methods"][name]
                    r = getattr(obj, name)(*[__jin(t, v) for t, v in zip(m["params"], a)])
                    out.append(None if m["ret"] == "void" else __jout(m["ret"], r))
            else:
                args = [__jin(t, v) for t, v in zip(sig["params"], case)]
                r = getattr(Solution(), sig["fn"])(*args)
                out = __jout(sig["params"][sig["out"]], args[sig["out"]]) if sig["ret"] == "void" else __jout(sig["ret"], r)
            print(__json.dumps(out))
        except Exception as e:
            print(__json.dumps({"__error": repr(e)}))
        __sys.stdout.flush()

__jmain()
